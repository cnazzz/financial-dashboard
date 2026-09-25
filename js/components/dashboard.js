import { appState } from '../core/state.js';
import { calculateKPI, calculateAccountBalances, aggregateByCategory, calculateBudgetUsage } from '../calculations/finance.js';
import { $, escapeHtml } from '../utils/dom.js';
import { formatCurrency, formatDate } from '../utils/format.js';

export function renderDashboard() {
    renderKpis();
    renderInsights();
    renderAccountBalances();
    renderCategoryChart();
    renderTrendChart();
    renderBudgetSection();
    renderAnalysisSection();
    renderAccountsSection();
}

function renderKpis() {
    const k = calculateKPI(appState.transactions);
    const container = $('kpiGrid');
    if (!container) return;
    const cards = [
        ['Total Income', k.totalIncome],
        ['Total Expense', k.totalExpense],
        ['Net Cashflow', k.netCashflow],
        ['Transactions', k.transactionCount, true]
    ];
    container.innerHTML = cards.map(([label, value, count]) =>
        '<div class="kpi-card"><div class="kpi-label">' + escapeHtml(label) +
        '</div><div class="kpi-value">' + (count ? String(value) : formatCurrency(value)) +
        '</div></div>'
    ).join('');
}

function renderInsights() {
    const el = $('insightsList');
    if (!el) return;
    const k = calculateKPI(appState.transactions);
    if (!appState.transactions.length) {
        el.innerHTML = '<div class="insight-item">Belum ada transaksi untuk dianalisis.</div>';
        return;
    }
    const expenseRate = k.totalIncome ? (k.totalExpense / k.totalIncome) * 100 : 0;
    const largest = [...appState.transactions]
        .filter(t => t.type === 'Expense')
        .sort((a, b) => b.amount - a.amount)[0];

    el.innerHTML = [
        '<div class="insight-item">Net cashflow: <strong>' + formatCurrency(k.netCashflow) + '</strong></div>',
        '<div class="insight-item">Rasio pengeluaran terhadap pemasukan: <strong>' + expenseRate.toFixed(1) + '%</strong></div>',
        largest ? '<div class="insight-item">Pengeluaran terbesar: <strong>' +
            escapeHtml(largest.category) + '</strong> — ' + formatCurrency(largest.amount) + '</div>' : ''
    ].join('');
}

function renderAccountBalances() {
    const el = $('accountBalances');
    if (!el) return;
    const balances = calculateAccountBalances(appState.accounts, appState.transactions);
    el.innerHTML = balances.length ? balances.map(b =>
        '<div class="account-balance-card"><h4>' + escapeHtml(b.account) +
        '</h4><div class="amount">' + formatCurrency(b.balance) + '</div></div>'
    ).join('') : '<div class="empty-state">Belum ada data akun.</div>';
}

function renderCategoryChart() {
    const canvas = $('categoryChart');
    if (!canvas || typeof Chart === 'undefined') return;
    appState.charts.category?.destroy();

    const data = {};
    appState.transactions.filter(t => t.type === 'Expense').forEach(t => {
        data[t.category || 'Uncategorized'] = (data[t.category || 'Uncategorized'] || 0) + t.amount;
    });

    appState.charts.category = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels: Object.keys(data), datasets: [{ data: Object.values(data) }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderTrendChart() {
    const canvas = $('trendChart');
    if (!canvas || typeof Chart === 'undefined') return;
    appState.charts.trend?.destroy();

    const data = {};
    appState.transactions.forEach(t => {
        const day = formatDate(t.date, 'YYYY-MM-DD');
        data[day] ??= { Income: 0, Expense: 0 };
        if (t.type === 'Income' || t.type === 'Expense') data[day][t.type] += t.amount;
    });

    const labels = Object.keys(data).sort();
    appState.charts.trend = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Income', data: labels.map(d => data[d].Income), tension: 0.3 },
                { label: 'Expense', data: labels.map(d => data[d].Expense), tension: 0.3 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderBudgetSection() {
    const el = $('budgetGrid');
    if (!el) return;
    el.innerHTML = appState.budgets.length ? appState.budgets.map(b => {
        const budget = Number(b.budget ?? b.amount ?? 0) || 0;
        const actual = Number(b.actual ?? b.spent ?? 0) || 0;
        const { percentage, progressPercentage, remaining } = calculateBudgetUsage(budget, actual);
        return '<div class="budget-card"><h4>' + escapeHtml(b.category ?? '') +
            '</h4><div class="budget-info"><span>Budget:</span><strong>' + formatCurrency(budget) +
            '</strong></div><div class="budget-info"><span>Terpakai:</span><strong>' + formatCurrency(actual) +
            '</strong></div><div class="budget-info"><span>Sisa:</span><strong>' + formatCurrency(remaining) +
            '</strong></div><div class="budget-progress"><div class="budget-progress-bar" style="width:' +
            progressPercentage + '%"></div></div><div class="budget-status">' + percentage.toFixed(0) +
            '% Terpakai</div></div>';
    }).join('') : '<div class="empty-state">Belum ada data budget.</div>';
}

function renderAnalysisSection() {
    const expenses = aggregateByCategory(appState.transactions, 'Expense').slice(0, 5);
    const incomes = aggregateByCategory(appState.transactions, 'Income').slice(0, 5);
    renderList($('topExpensesList'), expenses);
    renderList($('topIncomeList'), incomes);
    const k = calculateKPI(appState.transactions);
    renderList($('savingsList'), [{ category: 'Net Cashflow', amount: k.netCashflow }]);
}

function renderList(el, items) {
    if (!el) return;
    el.innerHTML = items.length ? items.map(i =>
        '<div class="analysis-item"><span>' + escapeHtml(i.category) +
        '</span><strong>' + formatCurrency(i.amount) + '</strong></div>'
    ).join('') : '<div class="empty-state">Belum ada data</div>';
}

function renderAccountsSection() {
    const el = $('accountsGrid');
    if (!el) return;
    const balances = calculateAccountBalances(appState.accounts, appState.transactions);
    el.innerHTML = appState.accounts.length ? appState.accounts.map(a => {
        const name = a.name ?? a.account ?? '';
        const balance = balances.find(b => b.account === name)?.balance ??
            Number(a.initialBalance ?? a.balance ?? 0);
        return '<div class="account-card"><h4>' + escapeHtml(name) +
            '</h4><div class="account-type">' + escapeHtml(a.type ?? '') +
            '</div><div class="account-balance">' + formatCurrency(balance) + '</div></div>';
    }).join('') : '<div class="empty-state">Belum ada data akun.</div>';
}
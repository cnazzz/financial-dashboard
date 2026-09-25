const DEFAULT_SETTINGS = {
    currency: 'IDR',
    dateFormat: 'DD/MM/YYYY',
    refreshSeconds: 300
};

const PAYMENT_METHODS = ['Tunai', 'Transfer Bank', 'Kartu Debit', 'Kartu Kredit', 'E-Wallet', 'QRIS'];

const appState = {
    apiUrl: localStorage.getItem('apiUrl') || '',
    transactions: [],
    accounts: [],
    categories: [],
    budgets: [],
    settings: { ...DEFAULT_SETTINGS },
    filters: { month: '', category: '', type: '' },
    currentPage: 1,
    pageSize: 10,
    charts: { category: null, trend: null },
    editingTransactionId: null,
    autoRefreshInterval: null,
    lastUpdated: null
};

document.addEventListener('DOMContentLoaded', initializeApp);

function $(id) { return document.getElementById(id); }

function initializeApp() {
    loadSettings();
    setDefaultFormValues();
    attachEventListeners();
    setupAutoRefresh();
    loadDashboardData();
}

function setDefaultFormValues() {
    const today = new Date();
    if ($('txDate') && !$('txDate').value) $('txDate').valueAsDate = today;
    if ($('monthFilter') && !$('monthFilter').value) {
        $('monthFilter').value = today.toISOString().slice(0, 7);
        appState.filters.month = $('monthFilter').value;
    }
    if ($('budgetMonth') && !$('budgetMonth').value) $('budgetMonth').value = today.toISOString().slice(0, 7);
}

function attachEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', handleNavigation));
    $('monthFilter')?.addEventListener('change', applyFilters);
    $('categoryFilter')?.addEventListener('change', applyFilters);
    $('typeFilter')?.addEventListener('change', applyFilters);
    $('addTransactionBtn')?.addEventListener('click', openAddTransactionModal);
    $('closeTransactionModal')?.addEventListener('click', closeTransactionModal);
    $('cancelTransactionBtn')?.addEventListener('click', closeTransactionModal);
    $('transactionForm')?.addEventListener('submit', handleTransactionSubmit);
    $('txType')?.addEventListener('change', populateTransactionCategories);
    $('txCategory')?.addEventListener('change', populateSubcategories);
    $('saveSettingsBtn')?.addEventListener('click', saveSettings);
    $('exportDataBtn')?.addEventListener('click', exportData);
    $('prevBtn')?.addEventListener('click', previousPage);
    $('nextBtn')?.addEventListener('click', nextPage);
    $('addBudgetBtn')?.addEventListener('click', () => openModal('budgetModal'));
    $('closeBudgetModal')?.addEventListener('click', () => closeModal('budgetModal'));
    $('cancelBudgetBtn')?.addEventListener('click', () => closeModal('budgetModal'));
    $('addAccountBtn')?.addEventListener('click', () => openModal('accountModal'));
    $('closeAccountModal')?.addEventListener('click', () => closeModal('accountModal'));
    $('cancelAccountBtn')?.addEventListener('click', () => closeModal('accountModal'));
    $('menuToggle')?.addEventListener('click', toggleSidebar);
    $('menuToggleMobile')?.addEventListener('click', toggleSidebar);
    ['transactionModal', 'budgetModal', 'accountModal'].forEach(id => $(id)?.addEventListener('click', e => {
        if (e.target === $(id)) closeModal(id);
    }));
}

function loadSettings() {
    const saved = JSON.parse(localStorage.getItem('dashboardSettings') || '{}');
    appState.settings = { ...DEFAULT_SETTINGS, ...saved };
    appState.apiUrl = localStorage.getItem('apiUrl') || '';
    if ($('apiUrlInput')) $('apiUrlInput').value = appState.apiUrl;
    if ($('currencySelect')) $('currencySelect').value = appState.settings.currency;
    if ($('dateFormatSelect')) $('dateFormatSelect').value = appState.settings.dateFormat;
    if ($('dataRefresh')) $('dataRefresh').value = appState.settings.refreshSeconds;
}

function saveSettings() {
    const apiUrl = $('apiUrlInput')?.value.trim() || '';
    if (apiUrl && !apiUrl.includes('script.google.com')) {
        showToast('URL harus berasal dari Google Apps Script', 'error');
        return;
    }
    appState.apiUrl = apiUrl;
    appState.settings = {
        currency: $('currencySelect')?.value || 'IDR',
        dateFormat: $('dateFormatSelect')?.value || 'DD/MM/YYYY',
        refreshSeconds: Math.max(60, Number($('dataRefresh')?.value) || 300)
    };
    localStorage.setItem('apiUrl', apiUrl);
    localStorage.setItem('dashboardSettings', JSON.stringify(appState.settings));
    setupAutoRefresh();
    showToast('Pengaturan berhasil disimpan', 'success');
    if (apiUrl) loadDashboardData();
}

function setupAutoRefresh() {
    if (appState.autoRefreshInterval) clearInterval(appState.autoRefreshInterval);
    const seconds = Math.max(60, Number(appState.settings.refreshSeconds) || 300);
    appState.autoRefreshInterval = setInterval(() => {
        if (appState.apiUrl) loadDashboardData();
    }, seconds * 1000);
}

function buildApiFilters() {
    const month = $('monthFilter')?.value || '';
    appState.filters = {
        month,
        category: $('categoryFilter')?.value || '',
        type: $('typeFilter')?.value || ''
    };
    const filters = {
        dateFrom: null,
        dateTo: null,
        category: appState.filters.category,
        type: appState.filters.type,
        account: '',
        paymentMethod: ''
    };
    if (month) {
        const [year, m] = month.split('-').map(Number);
        filters.dateFrom = new Date(year, m - 1, 1).toISOString();
        filters.dateTo = new Date(year, m, 0, 23, 59, 59, 999).toISOString();
    }
    return filters;
}

async function loadDashboardData() {
    if (!appState.apiUrl) {
        hideLoading();
        showToast('API URL belum dikonfigurasi. Buka Settings untuk mengaturnya.', 'warning');
        return;
    }

    showLoading('Memuat data dashboard...');
    try {
        const response = await fetch(appState.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            redirect: 'follow',
            body: JSON.stringify({ action: 'getDashboardData', filters: buildApiFilters() })
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        appState.transactions = normalizeTransactions(data.transactions || []);
        appState.accounts = data.accounts || [];
        appState.categories = data.categories || [];
        appState.budgets = data.budgets || [];
        appState.lastUpdated = data.lastUpdated || new Date().toISOString();

        populateFilterDropdowns();
        populateTransactionDropdowns();
        renderDashboard();
        updateLiveStatus();
    } catch (error) {
        console.error('Dashboard load error:', error);
        showToast('Gagal memuat data: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function normalizeTransactions(items) {
    return items.map((t, index) => ({
        ...t,
        id: t.id ?? t.ID ?? String(index),
        date: t.date ?? t.Date ?? '',
        type: t.type ?? t.Type ?? '',
        category: t.category ?? t.Category ?? '',
        subcategory: t.subcategory ?? t.Subcategory ?? '',
        description: t.description ?? t.Description ?? '',
        amount: Number(t.amount ?? t.Amount ?? 0) || 0,
        paymentMethod: t.paymentMethod ?? t.PaymentMethod ?? '',
        account: t.account ?? t.Account ?? '',
        notes: t.notes ?? t.Notes ?? ''
    }));
}

function populateFilterDropdowns() {
    const select = $('categoryFilter');
    if (!select) return;
    const current = appState.filters.category;
    const categories = [...new Set(appState.transactions.map(t => t.category).filter(Boolean))].sort();
    select.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(category => select.add(new Option(category, category)));
    select.value = current;
}

function populateTransactionDropdowns() {
    const payment = $('txPayment');
    if (payment) {
        payment.innerHTML = '<option value="">Select Payment Method</option>';
        PAYMENT_METHODS.forEach(v => payment.add(new Option(v, v)));
    }
    const account = $('txAccount');
    if (account) {
        account.innerHTML = '<option value="">Select Account</option>';
        appState.accounts.forEach(a => {
            const name = a.name ?? a.account ?? '';
            if (name) account.add(new Option(name, name));
        });
    }
    populateTransactionCategories();
    const budgetCategory = $('budgetCategory');
    if (budgetCategory) {
        budgetCategory.innerHTML = '<option value="">Select Category</option>';
        [...new Set(appState.categories.map(c => c.category ?? c.name).filter(Boolean))].sort()
            .forEach(v => budgetCategory.add(new Option(v, v)));
    }
}

function populateTransactionCategories() {
    const type = $('txType')?.value || '';
    const category = $('txCategory');
    if (!category) return;
    const list = appState.categories.filter(c => !type || (c.type ?? c.Type) === type);
    const names = [...new Set(list.map(c => c.category ?? c.name).filter(Boolean))].sort();
    const current = category.value;
    category.innerHTML = '<option value="">Select Category</option>';
    names.forEach(v => category.add(new Option(v, v)));
    category.value = names.includes(current) ? current : '';
    populateSubcategories();
}

function populateSubcategories() {
    const type = $('txType')?.value || '';
    const selected = $('txCategory')?.value || '';
    const sub = $('txSubcategory');
    if (!sub) return;
    const names = [...new Set(appState.categories
        .filter(c => (!type || (c.type ?? c.Type) === type) && (c.category ?? c.name) === selected)
        .map(c => c.subcategory ?? c.Subcategory).filter(Boolean))].sort();
    sub.innerHTML = '<option value="">Select Subcategory</option>';
    names.forEach(v => sub.add(new Option(v, v)));
}

function renderDashboard() {
    renderKpis();
    renderInsights();
    renderAccountBalances();
    renderCategoryChart();
    renderTrendChart();
    renderTransactionsTable();
    renderBudgetSection();
    renderAnalysisSection();
    renderAccountsSection();
}

function calculateKPI() {
    let income = 0, expense = 0;
    appState.transactions.forEach(t => {
        if (t.type === 'Income') income += t.amount;
        if (t.type === 'Expense') expense += t.amount;
    });
    return { totalIncome: income, totalExpense: expense, netCashflow: income - expense, transactionCount: appState.transactions.length };
}

function renderKpis() {
    const k = calculateKPI();
    const container = $('kpiGrid');
    if (!container) return;
    const cards = [
        ['Total Income', k.totalIncome],
        ['Total Expense', k.totalExpense],
        ['Net Cashflow', k.netCashflow],
        ['Transactions', k.transactionCount, true]
    ];
    container.innerHTML = cards.map(([label, value, count]) =>
        '<div class="kpi-card"><div class="kpi-label">' + escapeHtml(label) + '</div><div class="kpi-value">' +
        (count ? String(value) : formatCurrency(value)) + '</div></div>'
    ).join('');
}

function renderInsights() {
    const el = $('insightsList');
    if (!el) return;
    const k = calculateKPI();
    if (!appState.transactions.length) {
        el.innerHTML = '<div class="insight-item">Belum ada transaksi untuk dianalisis.</div>';
        return;
    }
    const expenseRate = k.totalIncome ? (k.totalExpense / k.totalIncome) * 100 : 0;
    const largest = [...appState.transactions].filter(t => t.type === 'Expense').sort((a,b) => b.amount - a.amount)[0];
    el.innerHTML = [
        '<div class="insight-item">Net cashflow: <strong>' + formatCurrency(k.netCashflow) + '</strong></div>',
        '<div class="insight-item">Rasio pengeluaran terhadap pemasukan: <strong>' + expenseRate.toFixed(1) + '%</strong></div>',
        largest ? '<div class="insight-item">Pengeluaran terbesar: <strong>' + escapeHtml(largest.category) + '</strong> — ' + formatCurrency(largest.amount) + '</div>' : ''
    ].join('');
}

function calculateAccountBalances() {
    const balances = {};
    appState.accounts.forEach(a => {
        const name = a.name ?? a.account;
        balances[name] = Number(a.initialBalance ?? a.balance ?? 0) || 0;
    });
    appState.transactions.forEach(t => {
        if (!t.account) return;
        if (t.type === 'Income') balances[t.account] = (balances[t.account] || 0) + t.amount;
        if (t.type === 'Expense') balances[t.account] = (balances[t.account] || 0) - t.amount;
    });
    return Object.entries(balances).map(([account, balance]) => ({ account, balance })).sort((a,b) => b.balance - a.balance);
}

function renderAccountBalances() {
    const el = $('accountBalances');
    if (!el) return;
    const balances = calculateAccountBalances();
    el.innerHTML = balances.length ? balances.map(b =>
        '<div class="account-balance-card"><h4>' + escapeHtml(b.account) + '</h4><div class="amount">' + formatCurrency(b.balance) + '</div></div>'
    ).join('') : '<div class="empty-state">Belum ada data akun.</div>';
}

function renderCategoryChart() {
    const canvas = $('categoryChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (appState.charts.category) appState.charts.category.destroy();
    const data = {};
    appState.transactions.filter(t => t.type === 'Expense').forEach(t => data[t.category] = (data[t.category] || 0) + t.amount);
    appState.charts.category = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels: Object.keys(data), datasets: [{ data: Object.values(data) }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderTrendChart() {
    const canvas = $('trendChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (appState.charts.trend) appState.charts.trend.destroy();
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

function renderTransactionsTable() {
    const tbody = $('transactionTable');
    if (!tbody) return;
    const totalPages = Math.max(1, Math.ceil(appState.transactions.length / appState.pageSize));
    appState.currentPage = Math.min(appState.currentPage, totalPages);
    const start = (appState.currentPage - 1) * appState.pageSize;
    const rows = appState.transactions.slice(start, start + appState.pageSize);
    tbody.innerHTML = rows.length ? rows.map(t => {
        const sign = t.type === 'Expense' ? '-' : '+';
        const cls = t.type === 'Expense' ? 'negative' : '';
        return '<tr><td>' + formatDate(t.date) + '</td><td>' + escapeHtml(t.description) +
            '</td><td>' + escapeHtml(t.type) + '</td><td>' + escapeHtml(t.category) +
            '</td><td class="' + cls + '">' + sign + ' ' + formatCurrency(t.amount) +
            '</td><td>' + escapeHtml(t.account) + '</td><td><button class="btn btn-small" data-action="edit" data-id="' +
            escapeHtml(String(t.id)) + '">Edit</button> <button class="btn btn-small btn-danger" data-action="delete" data-id="' +
            escapeHtml(String(t.id)) + '">Hapus</button></td></tr>';
    }).join('') : '<tr><td colspan="7" style="text-align:center;padding:30px">Tidak ada transaksi</td></tr>';

    tbody.querySelectorAll('[data-action="edit"]').forEach(b => b.addEventListener('click', () => editTransaction(b.dataset.id)));
    tbody.querySelectorAll('[data-action="delete"]').forEach(b => b.addEventListener('click', () => deleteTransaction(b.dataset.id)));
    if ($('pageInfo')) $('pageInfo').textContent = 'Page ' + appState.currentPage + ' / ' + totalPages;
    if ($('prevBtn')) $('prevBtn').disabled = appState.currentPage === 1;
    if ($('nextBtn')) $('nextBtn').disabled = appState.currentPage === totalPages;
}

function renderBudgetSection() {
    const el = $('budgetGrid');
    if (!el) return;
    el.innerHTML = appState.budgets.length ? appState.budgets.map(b => {
        const budget = Number(b.budget ?? b.amount ?? 0) || 0;
        const actual = Number(b.actual ?? b.spent ?? 0) || 0;
        const pct = budget ? actual / budget * 100 : 0;
        return '<div class="budget-card"><h4>' + escapeHtml(b.category ?? '') + '</h4><div class="budget-info"><span>Budget:</span><strong>' +
            formatCurrency(budget) + '</strong></div><div class="budget-info"><span>Terpakai:</span><strong>' + formatCurrency(actual) +
            '</strong></div><div class="budget-info"><span>Sisa:</span><strong>' + formatCurrency(budget - actual) +
            '</strong></div><div class="budget-progress"><div class="budget-progress-bar" style="width:' + Math.min(100, Math.max(0, pct)) + '%"></div></div><div class="budget-status">' +
            pct.toFixed(0) + '% Terpakai</div></div>';
    }).join('') : '<div class="empty-state">Belum ada data budget.</div>';
}

function renderAnalysisSection() {
    const expenses = aggregateByCategory('Expense').slice(0, 5);
    const incomes = aggregateByCategory('Income').slice(0, 5);
    renderList($('topExpensesList'), expenses);
    renderList($('topIncomeList'), incomes);
    const k = calculateKPI();
    renderList($('savingsList'), [{ category: 'Net Cashflow', amount: k.netCashflow }]);
}

function aggregateByCategory(type) {
    const data = {};
    appState.transactions.filter(t => t.type === type).forEach(t => data[t.category] = (data[t.category] || 0) + t.amount);
    return Object.entries(data).map(([category, amount]) => ({ category, amount })).sort((a,b) => b.amount - a.amount);
}

function renderList(el, items) {
    if (!el) return;
    el.innerHTML = items.length ? items.map(i => '<div class="analysis-item"><span>' + escapeHtml(i.category) + '</span><strong>' +
        formatCurrency(i.amount) + '</strong></div>').join('') : '<div class="empty-state">Belum ada data</div>';
}

function renderAccountsSection() {
    const el = $('accountsGrid');
    if (!el) return;
    const balances = calculateAccountBalances();
    el.innerHTML = appState.accounts.length ? appState.accounts.map(a => {
        const name = a.name ?? a.account ?? '';
        const balance = balances.find(b => b.account === name)?.balance ?? Number(a.initialBalance ?? a.balance ?? 0);
        return '<div class="account-card"><h4>' + escapeHtml(name) + '</h4><div class="account-type">' + escapeHtml(a.type ?? '') +
            '</div><div class="account-balance">' + formatCurrency(balance) + '</div></div>';
    }).join('') : '<div class="empty-state">Belum ada data akun.</div>';
}

function openAddTransactionModal() {
    appState.editingTransactionId = null;
    if ($('transactionModalTitle')) $('transactionModalTitle').textContent = 'Add Transaction';
    $('transactionForm')?.reset();
    setDefaultFormValues();
    openModal('transactionModal');
}

function editTransaction(id) {
    const t = appState.transactions.find(x => String(x.id) === String(id));
    if (!t) return;
    appState.editingTransactionId = t.id;
    if ($('transactionModalTitle')) $('transactionModalTitle').textContent = 'Edit Transaction';
    $('txDate').value = toInputDate(t.date);
    $('txType').value = t.type;
    populateTransactionCategories();
    $('txCategory').value = t.category;
    populateSubcategories();
    $('txSubcategory').value = t.subcategory;
    $('txDescription').value = t.description;
    $('txAmount').value = t.amount;
    $('txPayment').value = t.paymentMethod;
    $('txAccount').value = t.account;
    $('txNotes').value = t.notes;
    openModal('transactionModal');
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    if (!appState.apiUrl) return showToast('API URL belum dikonfigurasi', 'error');
    const amount = Number($('txAmount').value);
    if (!$('txDate').value || !$('txType').value || !$('txCategory').value || !amount || !$('txAccount').value) {
        return showToast('Harap isi field transaksi yang wajib', 'error');
    }
    const payload = {
        action: appState.editingTransactionId ? 'updateTransaction' : 'saveTransaction',
        id: appState.editingTransactionId || null,
        data: {
            date: $('txDate').value,
            type: $('txType').value,
            category: $('txCategory').value,
            subcategory: $('txSubcategory').value,
            description: $('txDescription').value.trim(),
            amount,
            paymentMethod: $('txPayment').value,
            account: $('txAccount').value,
            notes: $('txNotes').value.trim()
        }
    };
    showLoading('Menyimpan transaksi...');
    try {
        const response = await postApi(payload);
        if (!response.success) throw new Error(response.error || response.message || 'Operasi gagal');
        showToast(response.message || 'Transaksi berhasil disimpan', 'success');
        closeModal('transactionModal');
        await loadDashboardData();
    } catch (error) {
        showToast('Gagal menyimpan transaksi: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function deleteTransaction(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) return;
    if (!appState.apiUrl) return showToast('API URL belum dikonfigurasi', 'error');
    showLoading('Menghapus transaksi...');
    try {
        const result = await postApi({ action: 'deleteTransaction', id });
        if (!result.success) throw new Error(result.error || result.message || 'Operasi gagal');
        showToast(result.message || 'Transaksi dihapus', 'success');
        await loadDashboardData();
    } catch (error) {
        showToast('Gagal menghapus transaksi: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function postApi(payload) {
    const response = await fetch(appState.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
}

function applyFilters() {
    appState.currentPage = 1;
    loadDashboardData();
}

function previousPage() {
    if (appState.currentPage > 1) {
        appState.currentPage--;
        renderTransactionsTable();
    }
}

function nextPage() {
    const total = Math.ceil(appState.transactions.length / appState.pageSize);
    if (appState.currentPage < total) {
        appState.currentPage++;
        renderTransactionsTable();
    }
}

function handleNavigation(e) {
    e.preventDefault();
    const name = e.currentTarget.dataset.section;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    e.currentTarget.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    $(name + '-section')?.classList.add('active');
    if ($('sidebar')?.classList.contains('active')) toggleSidebar();
}

function toggleSidebar() {
    $('sidebar')?.classList.toggle('active');
}

function openModal(id) { $(id)?.classList.add('active'); }
function closeModal(id) { $(id)?.classList.remove('active'); }
function closeTransactionModal() { closeModal('transactionModal'); appState.editingTransactionId = null; }

function updateLiveStatus() {
    const dot = document.querySelector('.status-dot');
    if (dot) dot.classList.add('live');
    const status = document.querySelector('.status-indicator span:last-child');
    if (status) status.textContent = appState.lastUpdated ? 'Live Data • ' + formatDate(appState.lastUpdated, 'HH:mm:ss') : 'Live Data';
}

function showLoading(message) {
    if ($('loadingText')) $('loadingText').textContent = message;
    $('loadingOverlay')?.classList.add('active');
}

function hideLoading() { $('loadingOverlay')?.classList.remove('active'); }

function showToast(message, type = 'success') {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function formatCurrency(value) {
    const currency = appState.settings.currency || 'IDR';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function formatDate(value, format) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    if (format === 'YYYY-MM-DD') return date.toISOString().slice(0, 10);
    if (format === 'HH:mm:ss') return date.toLocaleTimeString('id-ID', { hour12: false });
    if (format === 'DD/MM/YYYY') return date.toLocaleDateString('id-ID');
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toInputDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function exportData() {
    const blob = new Blob([JSON.stringify({
        exportedAt: new Date().toISOString(),
        transactions: appState.transactions,
        accounts: appState.accounts,
        budgets: appState.budgets
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'financial-dashboard-export.json';
    a.click();
    URL.revokeObjectURL(url);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[ch]));
}

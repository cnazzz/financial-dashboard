// ===== CONFIGURATION =====
let API_URL = localStorage.getItem('apiUrl') || '';

// ===== APP STATE =====
const appState = {
    transactions: [],
    accounts: [],
    categories: [],
    budgets: [],
    settings: {},
    filters: {
        dateFrom: null, dateTo: null, type: '', category: '', account: '', paymentMethod: ''
    },
    currentPage: 1,
    pageSize: 10,
    charts: {},
    editingTransactionId: null,
    autoRefreshInterval: null,
    lastUpdated: null
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    console.log('Initializing Financial Dashboard...');
    
    loadApiUrl();
    
    if (!API_URL) {
        showToast('⚠️ Silakan set Google Apps Script API URL di Pengaturan terlebih dahulu', 'warning');
    }
    
    const today = new Date();
    document.getElementById('formDate').valueAsDate = today;
    
    attachEventListeners();
    loadDashboardData();
    setupAutoRefresh();
    loadTheme();
}

function attachEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', handleNavigation);
    });

    document.getElementById('dateRangeFilter').addEventListener('change', handleDateRangeChange);
    document.getElementById('dateFrom').addEventListener('change', applyFilters);
    document.getElementById('dateTo').addEventListener('change', applyFilters);
    document.getElementById('categoryFilter').addEventListener('change', applyFilters);
    document.getElementById('accountFilter').addEventListener('change', applyFilters);
    document.getElementById('typeFilter').addEventListener('change', applyFilters);

    document.getElementById('refreshBtn').addEventListener('click', forceRefresh);
    document.getElementById('addTransactionBtn').addEventListener('click', openAddModal);
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);
    document.getElementById('formType').addEventListener('change', handleTypeChange);
    document.getElementById('savSettingsBtn').addEventListener('click', saveSettings);

    document.getElementById('transactionModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });

    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }

    document.getElementById('prevPage').addEventListener('click', previousPage);
    document.getElementById('nextPage').addEventListener('click', nextPage);
}

// ===== API CONFIGURATION =====
function loadApiUrl() {
    API_URL = localStorage.getItem('apiUrl') || '';
    document.getElementById('apiUrlSetting').value = API_URL;
}

function saveSettings() {
    const newApiUrl = document.getElementById('apiUrlSetting').value.trim();
    
    if (!newApiUrl) {
        showToast('API URL tidak boleh kosong', 'error');
        return;
    }

    if (!newApiUrl.includes('script.google.com')) {
        showToast('URL harus dari Google Apps Script', 'error');
        return;
    }

    localStorage.setItem('apiUrl', newApiUrl);
    API_URL = newApiUrl;
    showToast('Pengaturan disimpan. Reload halaman untuk testing.', 'success');
}

// ===== DATA LOADING (FIXED FETCH) =====
function loadDashboardData() {
    if (!API_URL) {
        showError('API URL belum dikonfigurasi. Silakan set di Pengaturan.');
        return;
    }

    showLoading('Memuat data dashboard...');
    const filters = calculateFilterDates();
    
    fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        redirect: 'follow',
        body: JSON.stringify({
            action: 'getDashboardData',
            filters: filters
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showError('Error: ' + data.error);
            hideLoading();
            return;
        }

        appState.transactions = data.transactions || [];
        appState.accounts = data.accounts || [];
        appState.categories = data.categories || [];
        appState.budgets = data.budgets || [];
        appState.settings = data.settings || {};
        appState.lastUpdated = data.lastUpdated;

        populateFilterDropdowns();
        populateFormDropdowns();
        populateSettingsForm();
        
        renderDashboard();
        updateLiveStatus();
        hideLoading();
    })
    .catch(error => {
        console.error('Fetch Error:', error);
        showError('Gagal terhubung ke server: ' + error.message);
        hideLoading();
    });
}

function calculateFilterDates() {
    const today = new Date();
    let dateFrom = new Date();
    let dateTo = new Date();

    const rangeValue = document.getElementById('dateRangeFilter').value;

    switch(rangeValue) {
        case 'today':
            dateFrom.setHours(0, 0, 0, 0); dateTo.setHours(23, 59, 59, 999); break;
        case 'yesterday':
            dateFrom.setDate(dateFrom.getDate() - 1); dateFrom.setHours(0, 0, 0, 0);
            dateTo.setDate(dateTo.getDate() - 1); dateTo.setHours(23, 59, 59, 999); break;
        case 'thisweek':
            const first = today.getDate() - today.getDay();
            dateFrom.setDate(first); dateFrom.setHours(0, 0, 0, 0);
            dateTo.setHours(23, 59, 59, 999); break;
        case 'thismonth':
            dateFrom.setDate(1); dateFrom.setHours(0, 0, 0, 0);
            dateTo.setHours(23, 59, 59, 999); break;
        case 'lastmonth':
            dateFrom.setMonth(dateFrom.getMonth() - 1); dateFrom.setDate(1); dateFrom.setHours(0, 0, 0, 0);
            dateTo = new Date(dateFrom.getFullYear(), dateFrom.getMonth() + 1, 0); dateTo.setHours(23, 59, 59, 999); break;
        case 'thisyear':
            dateFrom.setMonth(0); dateFrom.setDate(1); dateFrom.setHours(0, 0, 0, 0);
            dateTo.setHours(23, 59, 59, 999); break;
        case 'custom':
            const fromInput = document.getElementById('dateFrom').value;
            const toInput = document.getElementById('dateTo').value;
            if (fromInput) dateFrom = new Date(fromInput);
            if (toInput) dateTo = new Date(toInput);
            dateTo.setHours(23, 59, 59, 999); break;
    }

    return {
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        type: document.getElementById('typeFilter').value || '',
        category: document.getElementById('categoryFilter').value || '',
        account: document.getElementById('accountFilter').value || '',
        paymentMethod: ''
    };
}

// ===== FILTER HANDLING =====
function handleDateRangeChange() {
    const customRange = document.getElementById('customDateRange');
    if (document.getElementById('dateRangeFilter').value === 'custom') {
        customRange.style.display = 'flex';
    } else {
        customRange.style.display = 'none';
        applyFilters();
    }
}

function applyFilters() {
    appState.currentPage = 1;
    loadDashboardData();
}

function populateFilterDropdowns() {
    const categoryFilter = document.getElementById('categoryFilter');
    const existingCategories = [...new Set(appState.transactions.map(t => t.category))];
    existingCategories.forEach(cat => {
        if (!Array.from(categoryFilter.options).find(opt => opt.value === cat)) {
            const option = document.createElement('option');
            option.value = cat; option.textContent = cat;
            categoryFilter.appendChild(option);
        }
    });

    const accountFilter = document.getElementById('accountFilter');
    appState.accounts.forEach(acc => {
        if (!Array.from(accountFilter.options).find(opt => opt.value === acc.name)) {
            const option = document.createElement('option');
            option.value = acc.name; option.textContent = acc.name;
            accountFilter.appendChild(option);
        }
    });
}

// ===== DASHBOARD RENDERING =====
function renderDashboard() {
    const kpi = calculateKPI(appState.transactions);

    document.getElementById('totalIncomeValue').textContent = formatCurrency(kpi.totalIncome);
    document.getElementById('totalExpenseValue').textContent = formatCurrency(kpi.totalExpense);
    document.getElementById('netCashflowValue').textContent = formatCurrency(kpi.netCashflow);
    document.getElementById('transactionCountValue').textContent = kpi.transactionCount;

    document.getElementById('netCashflowTrend').textContent = kpi.netCashflow >= 0 ? '✅ Positif' : '⚠️ Negatif';
    document.getElementById('netCashflowTrend').style.color = kpi.netCashflow >= 0 ? '#16a34a' : '#dc2626';

    renderInsights(appState.transactions);
    renderCashflowChart(appState.transactions);
    renderExpenseChart(appState.transactions);
    renderIncomeChart(appState.transactions);
    renderAccountChart();
    renderAccountBalances();
    renderTransactionsTable();
    renderBudgetSection();
    renderAnalysisSection();
    renderAccountsSection();
}

function calculateKPI(transactions) {
    let totalIncome = 0; let totalExpense = 0;
    transactions.forEach(txn => {
        if (txn.type === 'Income') totalIncome += txn.amount;
        else if (txn.type === 'Expense') totalExpense += txn.amount;
    });
    return {
        totalIncome: totalIncome, totalExpense: totalExpense,
        netCashflow: totalIncome - totalExpense, transactionCount: transactions.length
    };
}

function renderInsights(transactions) {
    const insightsList = document.getElementById('insightsList');
    insightsList.innerHTML = '';

    if (transactions.length === 0) {
        insightsList.innerHTML = '<div class="insight-item">📊 Belum ada transaksi. Mulai dengan menambahkan transaksi pertama Anda.</div>';
        return;
    }

    const kpi = calculateKPI(transactions);
    const insights = [];
    const expenseByCategory = {};
    
    transactions.forEach(t => {
        if (t.type === 'Expense') expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
    });

    const topCategory = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])[0];
    if (topCategory) insights.push(`📌 Kategori pengeluaran terbesar adalah <strong>${topCategory[0]}</strong> dengan total ${formatCurrency(topCategory[1])}.`);
    if (kpi.netCashflow > 0) insights.push(`✅ Cashflow Anda positif sebesar ${formatCurrency(kpi.netCashflow)}.`);
    else if (kpi.netCashflow < 0) insights.push(`⚠️ Cashflow Anda negatif sebesar ${formatCurrency(Math.abs(kpi.netCashflow))}.`);
    else insights.push(`⚖️ Pemasukan dan pengeluaran Anda seimbang.`);

    if (kpi.totalIncome > 0) {
        const ratio = ((kpi.totalExpense / kpi.totalIncome) * 100).toFixed(1);
        insights.push(`💰 Pengeluaran Anda mencapai ${ratio}% dari pendapatan.`);
    }

    insights.forEach(insight => {
        const item = document.createElement('div');
        item.className = 'insight-item'; item.innerHTML = insight;
        insightsList.appendChild(item);
    });
}

// ===== CHART RENDERING =====
function renderCashflowChart(transactions) {
    const cashflowData = calculateCashflowData(transactions);
    const ctx = document.getElementById('cashflowChart').getContext('2d');

    if (appState.charts.cashflow) appState.charts.cashflow.destroy();

    appState.charts.cashflow = new Chart(ctx, {
        type: 'line',
        data: {
            labels: cashflowData.map(d => d.date),
            datasets: [
                { label: 'Pemasukan', data: cashflowData.map(d => d.income), borderColor: '#16a34a', backgroundColor: 'rgba(22, 163, 74, 0.1)', tension: 0.3, fill: true },
                { label: 'Pengeluaran', data: cashflowData.map(d => d.expense), borderColor: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.1)', tension: 0.3, fill: true },
                { label: 'Net', data: cashflowData.map(d => d.net), borderColor: '#2563eb', borderDash: [5, 5], backgroundColor: 'rgba(37, 99, 235, 0.05)', tension: 0.3, fill: true }
            ]
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: true, position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return formatCurrency(value, true); } } } } }
    });
}

function renderExpenseChart(transactions) {
    const expenseData = calculateCategoryData(transactions, 'Expense');
    const ctx = document.getElementById('expenseChart').getContext('2d');

    if (appState.charts.expense) appState.charts.expense.destroy();
    const colors = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#ec4899'];

    appState.charts.expense = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: expenseData.map(d => d.category),
            datasets: [{ data: expenseData.map(d => d.amount), backgroundColor: colors.slice(0, expenseData.length), borderColor: '#ffffff', borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: function(context) { const amount = context.parsed; const total = context.dataset.data.reduce((a, b) => a + b, 0); const percentage = ((amount / total) * 100).toFixed(1); return context.label + ': ' + formatCurrency(amount) + ' (' + percentage + '%)'; } } } } }
    });
}

function renderIncomeChart(transactions) {
    const incomeData = calculateCategoryData(transactions, 'Income');
    const ctx = document.getElementById('incomeChart').getContext('2d');

    if (appState.charts.income) appState.charts.income.destroy();
    const colors = ['#16a34a', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];

    appState.charts.income = new Chart(ctx, {
        type: 'bar',
        data: { labels: incomeData.map(d => d.category), datasets: [{ label: 'Pemasukan', data: incomeData.map(d => d.amount), backgroundColor: colors.slice(0, incomeData.length), borderRadius: 8, borderSkipped: false }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: function(value) { return formatCurrency(value, true); } } } } }
    });
}

function renderAccountChart() {
    const balances = calculateAccountBalances();
    const ctx = document.getElementById('accountChart').getContext('2d');

    if (appState.charts.account) appState.charts.account.destroy();
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];

    appState.charts.account = new Chart(ctx, {
        type: 'bar',
        data: { labels: balances.map(b => b.account), datasets: [{ label: 'Saldo Akun', data: balances.map(b => b.balance), backgroundColor: colors.slice(0, balances.length), borderRadius: 8, borderSkipped: false }] },
        options: { responsive: true, maintainAspectRatio: true, indexAxis: 'x', plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return formatCurrency(value, true); } } } } }
    });
}

function calculateCashflowData(transactions) {
    const data = {};
    transactions.forEach(t => {
        const dateStr = formatDate(t.date, 'yyyy-MM-dd');
        if (!data[dateStr]) data[dateStr] = { income: 0, expense: 0, net: 0 };
        if (t.type === 'Income') data[dateStr].income += t.amount;
        else if (t.type === 'Expense') data[dateStr].expense += t.amount;
        data[dateStr].net = data[dateStr].income - data[dateStr].expense;
    });
    return Object.entries(data).sort((a, b) => new Date(a[0]) - new Date(b[0])).map(([date, value]) => ({ date: formatDate(new Date(date), 'dd MMM'), income: value.income, expense: value.expense, net: value.net }));
}

function calculateCategoryData(transactions, type) {
    const data = {};
    transactions.filter(t => t.type === type).forEach(t => { data[t.category] = (data[t.category] || 0) + t.amount; });
    return Object.entries(data).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category: category, amount: amount }));
}

function calculateAccountBalances() {
    const balances = {};
    appState.accounts.forEach(acc => { balances[acc.name] = acc.initialBalance; });
    appState.transactions.forEach(t => {
        if (t.type === 'Income') balances[t.account] = (balances[t.account] || 0) + t.amount;
        else if (t.type === 'Expense') balances[t.account] = (balances[t.account] || 0) - t.amount;
    });
    return Object.entries(balances).map(([account, balance]) => ({ account: account, balance: balance })).sort((a, b) => b.balance - a.balance);
}

// ===== TABLE RENDERING =====
function renderAccountBalances() {
    const container = document.getElementById('accountBalanceGrid');
    container.innerHTML = '';
    const balances = calculateAccountBalances();
    balances.forEach(balance => {
        const card = document.createElement('div');
        card.className = 'account-balance-card';
        card.innerHTML = `<h4>${balance.account}</h4><div class="amount">${formatCurrency(balance.balance)}</div>`;
        container.appendChild(card);
    });
}

function renderTransactionsTable() {
    const container = document.getElementById('transactionTableBody');
    container.innerHTML = '';

    const start = (appState.currentPage - 1) * appState.pageSize;
    const end = start + appState.pageSize;
    const paginatedTransactions = appState.transactions.slice(start, end);

    if (paginatedTransactions.length === 0) {
        container.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 30px;">Tidak ada transaksi ditemukan</td></tr>';
        return;
    }

    paginatedTransactions.forEach(txn => {
        const row = document.createElement('tr');
        const typeClass = 'type-' + txn.type.toLowerCase();
        const amountClass = txn.type === 'Expense' ? 'amount negative' : 'amount';
        const sign = txn.type === 'Expense' ? '-' : '+';

        row.innerHTML = `
            <td>${formatDate(txn.date, 'dd MMM yyyy')}</td>
            <td><span class="type-badge ${typeClass}">${txn.type}</span></td>
            <td>${txn.category}</td>
            <td>${txn.description}</td>
            <td class="${amountClass}">${sign} ${formatCurrency(txn.amount)}</td>
            <td>${txn.paymentMethod}</td>
            <td>${txn.account}</td>
            <td>
                <button class="btn btn-small" onclick="editTransaction('${txn.id}')">Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteTransaction('${txn.id}')">Hapus</button>
            </td>
        `;
        container.appendChild(row);
    });

    const totalPages = Math.ceil(appState.transactions.length / appState.pageSize) || 1;
    document.getElementById('pageInfo').textContent = `${appState.currentPage} / ${totalPages}`;
    document.getElementById('prevPage').disabled = appState.currentPage === 1;
    document.getElementById('nextPage').disabled = appState.currentPage === totalPages;
}

function renderAnalysisSection() {
    const topExpenses = calculateCategoryData(appState.transactions, 'Expense').slice(0, 5);
    const topIncomes = calculateCategoryData(appState.transactions, 'Income').slice(0, 5);

    const topExpensesContainer = document.getElementById('topExpenses');
    topExpensesContainer.innerHTML = topExpenses.length === 0 ? '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Belum ada data</div>' : '';
    topExpenses.forEach(item => {
        const element = document.createElement('div'); element.className = 'analysis-item';
        element.innerHTML = `<span class="analysis-item-name">${item.category}</span><span class="analysis-item-amount">${formatCurrency(item.amount)}</span>`;
        topExpensesContainer.appendChild(element);
    });

    const topIncomesContainer = document.getElementById('topIncomes');
    topIncomesContainer.innerHTML = topIncomes.length === 0 ? '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Belum ada data</div>' : '';
    topIncomes.forEach(item => {
        const element = document.createElement('div'); element.className = 'analysis-item';
        element.innerHTML = `<span class="analysis-item-name">${item.category}</span><span class="analysis-item-amount">${formatCurrency(item.amount)}</span>`;
        topIncomesContainer.appendChild(element);
    });
}

function renderBudgetSection() {
    const container = document.getElementById('budgetGrid');
    container.innerHTML = '';

    if (appState.budgets.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--text-secondary);">Belum ada data budget</div>';
        return;
    }

    appState.budgets.forEach(budget => {
        const card = document.createElement('div'); card.className = 'budget-card';
        const percentage = budget.percentageUsed || 0;
        let statusClass = percentage > 100 ? 'critical' : percentage > 90 ? 'critical' : percentage > 70 ? 'warning' : 'safe';
        let barClass = 'budget-progress-bar' + (statusClass === 'warning' ? ' warning' : statusClass === 'critical' ? ' critical' : '');

        card.innerHTML = `
            <h4>${budget.category}</h4>
            <div class="budget-info"><span class="budget-label">Budget:</span><span class="budget-value">${formatCurrency(budget.budget)}</span></div>
            <div class="budget-info"><span class="budget-label">Terpakai:</span><span class="budget-value">${formatCurrency(budget.actual)}</span></div>
            <div class="budget-info"><span class="budget-label">Sisa:</span><span class="budget-value">${formatCurrency(budget.remaining)}</span></div>
            <div class="budget-progress"><div class="${barClass}" style="width: ${Math.min(percentage, 100)}%"></div></div>
            <div class="budget-status ${statusClass}">${percentage.toFixed(0)}% Terpakai</div>
        `;
        container.appendChild(card);
    });
}

function renderAccountsSection() {
    const container = document.getElementById('accountsGrid');
    container.innerHTML = '';
    appState.accounts.forEach(account => {
        const balance = calculateAccountBalances().find(b => b.account === account.name)?.balance || account.initialBalance;
        const card = document.createElement('div'); card.className = 'account-card';
        card.innerHTML = `<h4>${account.name}</h4><div class="account-type">${account.type}</div><div class="account-balance">${formatCurrency(balance)}</div>`;
        container.appendChild(card);
    });
}

// ===== TRANSACTION MANAGEMENT (FIXED FETCH) =====
function openAddModal() {
    appState.editingTransactionId = null;
    document.getElementById('modalTitle').textContent = 'Tambah Transaksi';
    document.getElementById('transactionForm').reset();
    document.getElementById('formDate').valueAsDate = new Date();
    document.getElementById('transactionModal').classList.add('active');
}

function editTransaction(id) {
    const transaction = appState.transactions.find(t => t.id === id);
    if (!transaction) return;

    appState.editingTransactionId = id;
    document.getElementById('modalTitle').textContent = 'Edit Transaksi';

    document.getElementById('formDate').valueAsDate = new Date(transaction.date);
    document.getElementById('formType').value = transaction.type;
    document.getElementById('formCategory').value = transaction.category;
    document.getElementById('formSubcategory').value = transaction.subcategory;
    document.getElementById('formDescription').value = transaction.description;
    document.getElementById('formAmount').value = transaction.amount;
    document.getElementById('formPaymentMethod').value = transaction.paymentMethod;
    document.getElementById('formAccount').value = transaction.account;
    document.getElementById('formNotes').value = transaction.notes;

    handleTypeChange();
    document.getElementById('transactionModal').classList.add('active');
}

function closeModal() {
    document.getElementById('transactionModal').classList.remove('active');
    appState.editingTransactionId = null;
}

function handleTransactionSubmit(e) {
    e.preventDefault();

    if (!API_URL) {
        showToast('API URL belum dikonfigurasi', 'error'); return;
    }

    const formData = {
        date: document.getElementById('formDate').value,
        type: document.getElementById('formType').value,
        category: document.getElementById('formCategory').value,
        subcategory: document.getElementById('formSubcategory').value,
        description: document.getElementById('formDescription').value,
        amount: parseFloat(document.getElementById('formAmount').value),
        paymentMethod: document.getElementById('formPaymentMethod').value,
        account: document.getElementById('formAccount').value,
        notes: document.getElementById('formNotes').value
    };

    if (!formData.date || !formData.type || !formData.category || !formData.amount || !formData.account) {
        showToast('Harap isi semua field yang diperlukan', 'error'); return;
    }

    showLoading('Menyimpan transaksi...');

    const payload = {
        action: appState.editingTransactionId ? 'updateTransaction' : 'saveTransaction',
        id: appState.editingTransactionId || null,
        data: formData
    };

    fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        redirect: 'follow',
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(result => {
        hideLoading();
        if (result.success) {
            showToast(result.message || 'Transaksi berhasil disimpan', 'success');
            closeModal();
            applyFilters();
        } else {
            showToast(result.error || result.message, 'error');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error:', error);
        showToast('Gagal menyimpan transaksi: ' + error.message, 'error');
    });
}

function deleteTransaction(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) return;

    if (!API_URL) {
        showToast('API URL belum dikonfigurasi', 'error'); return;
    }

    showLoading('Menghapus transaksi...');
    
    fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        redirect: 'follow',
        body: JSON.stringify({
            action: 'deleteTransaction',
            id: id
        })
    })
    .then(response => response.json())
    .then(result => {
        hideLoading();
        if (result.success) {
            showToast(result.message || 'Transaksi dihapus', 'success');
            applyFilters();
        } else {
            showToast(result.error || result.message, 'error');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error:', error);
        showToast('Gagal menghapus transaksi: ' + error.message, 'error');
    });
}

// ===== UTILITIES & DROPDOWNS =====
function handleTypeChange() {
    const type = document.getElementById('formType').value;
    const categorySelect = document.getElementById('formCategory');
    const subcategorySelect = document.getElementById('formSubcategory');

    categorySelect.innerHTML = '<option value="">Pilih Kategori</option>';
    subcategorySelect.innerHTML = '<option value="">Pilih Sub Kategori</option>';

    // Filter kategori berdasarkan tipe yang dipilih
    const filteredCategories = appState.categories.filter(c => c.type === type);

    // --- PERBAIKAN: Ambil nama kategori yang UNIK saja (menghilangkan duplikat) ---
    const uniqueCategoryNames = [...new Set(filteredCategories.map(c => c.category))];

    uniqueCategoryNames.forEach(categoryName => {
        const option = document.createElement('option');
        option.value = categoryName;
        option.textContent = categoryName;
        categorySelect.appendChild(option);
    });

    // Event saat kategori dipilih untuk memunculkan subkategori
    categorySelect.onchange = function() {
        const selectedCat = this.value;
        subcategorySelect.innerHTML = '<option value="">Pilih Sub Kategori</option>';

        filteredCategories
            .filter(c => c.category === selectedCat && c.subcategory)
            .forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.subcategory;
                option.textContent = cat.subcategory;
                subcategorySelect.appendChild(option);
            });
    };
}

function populateFormDropdowns() {
    const paymentMethods = ['Tunai', 'Transfer Bank', 'Kartu Debit', 'Kartu Kredit', 'E-Wallet', 'QRIS'];
    const paymentSelect = document.getElementById('formPaymentMethod');
    paymentMethods.forEach(method => {
        if (!Array.from(paymentSelect.options).find(opt => opt.value === method)) {
            const option = document.createElement('option');
            option.value = method; option.textContent = method;
            paymentSelect.appendChild(option);
        }
    });

    const accountSelect = document.getElementById('formAccount');
    appState.accounts.forEach(acc => {
        if (!Array.from(accountSelect.options).find(opt => opt.value === acc.name)) {
            const option = document.createElement('option');
            option.value = acc.name; option.textContent = acc.name;
            accountSelect.appendChild(option);
        }
    });
}

function populateSettingsForm() {
    const settings = appState.settings;
    document.getElementById('themeSetting').value = settings.Theme || 'light';
    document.getElementById('autoRefreshSetting').value = settings['Refresh Interval'] || '30';
}

function handleNavigation(e) {
    e.preventDefault();
    const sectionName = this.getAttribute('data-section');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    this.classList.add('active');
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    document.getElementById(sectionName).classList.add('active');

    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('active')) toggleSidebar();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

function previousPage() {
    if (appState.currentPage > 1) {
        appState.currentPage--;
        renderTransactionsTable();
        window.scrollTo(0, 0);
    }
}

function nextPage() {
    const totalPages = Math.ceil(appState.transactions.length / appState.pageSize);
    if (appState.currentPage < totalPages) {
        appState.currentPage++;
        renderTransactionsTable();
        window.scrollTo(0, 0);
    }
}

function setupAutoRefresh() {
    const interval = parseInt(document.getElementById('autoRefreshSetting')?.value || 30) || 30;
    if (appState.autoRefreshInterval) clearInterval(appState.autoRefreshInterval);
    appState.autoRefreshInterval = setInterval(() => { loadDashboardData(); }, interval * 1000);
}

function forceRefresh() {
    const btn = document.getElementById('refreshBtn');
    btn.style.animation = 'spin 1s linear';
    loadDashboardData();
    setTimeout(() => { btn.style.animation = ''; }, 1000);
}

function updateLiveStatus() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    dot.classList.add('live');
    text.textContent = `Live • ${formatDate(new Date(), 'HH:mm:ss')}`;
}

function formatCurrency(value, short = false) {
    const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0, minimumFractionDigits: 0 });
    if (short && Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    return formatter.format(value);
}

function formatDate(date, format = 'dd MMM yyyy') {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-"; // Cegah tampilan "NaN" jika tanggal bermasalah
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format.replace('dd', day).replace('MMM', month).replace('yyyy', year).replace('HH', hours).replace('mm', minutes).replace('ss', seconds);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

function showLoading(text = 'Memuat...') {
    const overlay = document.getElementById('loadingOverlay');
    document.getElementById('loadingText').textContent = text;
    overlay.classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

function showError(message) {
    showToast(message, 'error');
}

function loadTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') document.body.classList.add('dark-theme');
}
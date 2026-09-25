import { getDashboardData } from './api/endpoints.js';
import { appState } from './core/state.js';
import { DEFAULT_SETTINGS } from './core/config.js';
import { $, closeModal, openModal, showLoading, hideLoading, showToast } from './utils/dom.js';
import { formatDate } from './utils/format.js';
import { renderDashboard } from './components/dashboard.js';
import {
    normalizeTransactions,
    populateFilterDropdowns,
    populateTransactionDropdowns,
    populateTransactionCategories,
    populateSubcategories,
    renderTransactionsTable,
    openAddTransactionModal,
    handleTransactionSubmit
} from './components/transactions.js';
import { attachNavigationListeners, attachModalListeners, toggleSidebar } from './components/navigation.js';

document.addEventListener('DOMContentLoaded', initializeApp);

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
    attachNavigationListeners();
    attachModalListeners();
    $('monthFilter')?.addEventListener('change', applyFilters);
    $('categoryFilter')?.addEventListener('change', applyFilters);
    $('typeFilter')?.addEventListener('change', applyFilters);
    $('addTransactionBtn')?.addEventListener('click', openAddTransactionModal);
    $('closeTransactionModal')?.addEventListener('click', closeTransactionForm);
    $('cancelTransactionBtn')?.addEventListener('click', closeTransactionForm);
    $('transactionForm')?.addEventListener('submit', e => handleTransactionSubmit(e, loadDashboardData));
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
}

function loadSettings() {
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem('dashboardSettings') || '{}');
    } catch {
        showToast('Pengaturan tersimpan tidak valid; menggunakan default.', 'warning');
    }
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
    updateLiveStatus('loading');
    try {
        const data = await getDashboardData(appState.apiUrl, buildApiFilters());
        appState.transactions = normalizeTransactions(data.transactions || []);
        appState.accounts = data.accounts || [];
        appState.categories = data.categories || [];
        appState.budgets = data.budgets || [];
        appState.lastUpdated = data.lastUpdated || new Date().toISOString();

        populateFilterDropdowns();
        populateTransactionDropdowns();
        renderDashboard();
        renderTransactionsTable(loadDashboardData);
        updateLiveStatus();
    } catch (error) {
        console.error('Dashboard load error:', error);
        updateLiveStatus('error');
        showToast('Gagal memuat data: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
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

function closeTransactionForm() {
    closeModal('transactionModal');
    appState.editingTransactionId = null;
}

function updateLiveStatus(state = 'live') {
    const dot = document.querySelector('.status-dot');
    const status = document.querySelector('.status-indicator span:last-child');
    if (!dot || !status) return;

    dot.classList.remove('live', 'error');

    if (state === 'error') {
        dot.classList.add('error');
        status.textContent = 'Connection error';
        return;
    }

    if (state === 'loading') {
        status.textContent = 'Connecting...';
        return;
    }

    dot.classList.add('live');
    status.textContent = appState.lastUpdated
        ? 'Live Data • ' + formatDate(appState.lastUpdated, 'HH:mm:ss')
        : 'Live Data';
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

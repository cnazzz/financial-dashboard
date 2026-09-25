import { DEFAULT_SETTINGS } from './config.js';

export const appState = {
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
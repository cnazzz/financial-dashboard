import { getDashboardData } from '../api/endpoints.js';
import { normalizeTransactions } from './transactionService.js';

export function buildDashboardFilters({ month = '', category = '', type = '' } = {}) {
    const filters = {
        dateFrom: null,
        dateTo: null,
        category,
        type,
        account: '',
        paymentMethod: ''
    };

    if (month) {
        const [year, monthNumber] = month.split('-').map(Number);
        if (Number.isInteger(year) && Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12) {
            filters.dateFrom = new Date(year, monthNumber - 1, 1).toISOString();
            filters.dateTo = new Date(year, monthNumber, 0, 23, 59, 59, 999).toISOString();
        }
    }

    return filters;
}

export async function loadDashboard(apiUrl, filterState) {
    const data = await getDashboardData(apiUrl, buildDashboardFilters(filterState));
    return {
        ...data,
        transactions: normalizeTransactions(data.transactions || []),
        accounts: data.accounts || [],
        categories: data.categories || [],
        budgets: data.budgets || [],
        lastUpdated: data.lastUpdated || new Date().toISOString()
    };
}

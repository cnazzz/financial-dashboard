import {
    saveTransaction as saveTransactionApi,
    updateTransaction as updateTransactionApi,
    deleteTransaction as deleteTransactionApi
} from '../api/endpoints.js';

export function normalizeTransactions(items = []) {
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

export function createTransaction(apiUrl, data) {
    return saveTransactionApi(apiUrl, data);
}

export function updateTransaction(apiUrl, id, data) {
    return updateTransactionApi(apiUrl, id, data);
}

export function removeTransaction(apiUrl, id) {
    return deleteTransactionApi(apiUrl, id);
}

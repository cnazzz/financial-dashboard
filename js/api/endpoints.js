import { postJson } from './client.js';

export function getDashboardData(apiUrl, filters) {
    return postJson(apiUrl, {
        action: 'getDashboardData',
        filters
    });
}

export function saveTransaction(apiUrl, data) {
    return postJson(apiUrl, {
        action: 'saveTransaction',
        data
    });
}

export function updateTransaction(apiUrl, id, data) {
    return postJson(apiUrl, {
        action: 'updateTransaction',
        id,
        data
    });
}

export function deleteTransaction(apiUrl, id) {
    return postJson(apiUrl, {
        action: 'deleteTransaction',
        id
    });
}

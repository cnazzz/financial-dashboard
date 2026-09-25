import { appState } from '../core/state.js';

export function formatCurrency(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: appState.settings.currency || 'IDR',
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

export function formatDate(value, format) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    if (format === 'YYYY-MM-DD') return date.toISOString().slice(0, 10);
    if (format === 'HH:mm:ss') return date.toLocaleTimeString('id-ID', { hour12: false });
    if (format === 'DD/MM/YYYY') return date.toLocaleDateString('id-ID');
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function toInputDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}
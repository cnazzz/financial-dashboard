import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardFilters } from '../js/services/dashboardService.js';
import { normalizeTransactions } from '../js/services/transactionService.js';

test('buildDashboardFilters creates month date range', () => {
    const filters = buildDashboardFilters({
        month: '2026-09',
        category: 'Food',
        type: 'Expense'
    });

    assert.equal(filters.category, 'Food');
    assert.equal(filters.type, 'Expense');
    assert.match(filters.dateFrom, /^2026-09-01T/);
    assert.match(filters.dateTo, /^2026-09-30T/);
});

test('buildDashboardFilters handles empty month', () => {
    const filters = buildDashboardFilters({ category: '', type: '' });

    assert.equal(filters.dateFrom, null);
    assert.equal(filters.dateTo, null);
    assert.equal(filters.account, '');
    assert.equal(filters.paymentMethod, '');
});

test('normalizeTransactions maps backend field variants', () => {
    const [transaction] = normalizeTransactions([{
        ID: 42,
        Date: '2026-09-25',
        Type: 'Expense',
        Category: 'Food',
        Amount: '125000',
        PaymentMethod: 'QRIS',
        Account: 'BCA'
    }]);

    assert.equal(transaction.id, 42);
    assert.equal(transaction.date, '2026-09-25');
    assert.equal(transaction.type, 'Expense');
    assert.equal(transaction.category, 'Food');
    assert.equal(transaction.amount, 125000);
    assert.equal(transaction.paymentMethod, 'QRIS');
    assert.equal(transaction.account, 'BCA');
});

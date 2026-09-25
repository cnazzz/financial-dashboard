import test from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateKPI,
    calculateAccountBalances,
    aggregateByCategory,
    calculateBudgetUsage
} from '../../js/calculations/finance.js';

test('calculateKPI calculates income, expense, and net cashflow', () => {
    const result = calculateKPI([
        { type: 'Income', amount: 5000000 },
        { type: 'Expense', amount: 1250000 },
        { type: 'Expense', amount: '750000' }
    ]);

    assert.deepEqual(result, {
        totalIncome: 5000000,
        totalExpense: 2000000,
        netCashflow: 3000000,
        transactionCount: 3
    });
});

test('calculateAccountBalances applies transactions to initial balances', () => {
    const result = calculateAccountBalances(
        [
            { name: 'Cash', initialBalance: 1000000 },
            { name: 'Bank', initialBalance: 5000000 }
        ],
        [
            { account: 'Cash', type: 'Income', amount: 500000 },
            { account: 'Bank', type: 'Expense', amount: 1250000 }
        ]
    );

    assert.deepEqual(result, [
        { account: 'Bank', balance: 3750000 },
        { account: 'Cash', balance: 1500000 }
    ]);
});

test('aggregateByCategory groups and sorts amounts', () => {
    const result = aggregateByCategory([
        { type: 'Expense', category: 'Food', amount: 100000 },
        { type: 'Expense', category: 'Bills', amount: 300000 },
        { type: 'Expense', category: 'Food', amount: 50000 },
        { type: 'Income', category: 'Salary', amount: 5000000 }
    ], 'Expense');

    assert.deepEqual(result, [
        { category: 'Bills', amount: 300000 },
        { category: 'Food', amount: 150000 }
    ]);
});

test('calculateBudgetUsage exposes remaining and capped progress', () => {
    assert.deepEqual(calculateBudgetUsage(1000000, 1250000), {
        budget: 1000000,
        actual: 1250000,
        remaining: -250000,
        percentage: 125,
        progressPercentage: 100
    });
});

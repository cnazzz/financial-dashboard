export function calculateKPI(transactions = []) {
    let totalIncome = 0;
    let totalExpense = 0;

    for (const transaction of transactions) {
        const amount = Number(transaction.amount) || 0;
        if (transaction.type === 'Income') totalIncome += amount;
        if (transaction.type === 'Expense') totalExpense += amount;
    }

    return {
        totalIncome,
        totalExpense,
        netCashflow: totalIncome - totalExpense,
        transactionCount: transactions.length
    };
}

export function calculateAccountBalances(accounts = [], transactions = []) {
    const balances = {};

    for (const account of accounts) {
        const name = account.name ?? account.account;
        if (!name) continue;
        balances[name] = Number(account.initialBalance ?? account.balance ?? 0) || 0;
    }

    for (const transaction of transactions) {
        if (!transaction.account) continue;
        if (transaction.type === 'Income') {
            balances[transaction.account] = (balances[transaction.account] || 0) + (Number(transaction.amount) || 0);
        }
        if (transaction.type === 'Expense') {
            balances[transaction.account] = (balances[transaction.account] || 0) - (Number(transaction.amount) || 0);
        }
    }

    return Object.entries(balances)
        .map(([account, balance]) => ({ account, balance }))
        .sort((a, b) => b.balance - a.balance);
}

export function aggregateByCategory(transactions = [], type) {
    const totals = {};

    for (const transaction of transactions) {
        if (transaction.type !== type) continue;
        const category = transaction.category || 'Uncategorized';
        totals[category] = (totals[category] || 0) + (Number(transaction.amount) || 0);
    }

    return Object.entries(totals)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);
}

export function calculateBudgetUsage(budget, actual) {
    const budgetAmount = Number(budget) || 0;
    const actualAmount = Number(actual) || 0;
    const percentage = budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0;

    return {
        budget: budgetAmount,
        actual: actualAmount,
        remaining: budgetAmount - actualAmount,
        percentage,
        progressPercentage: Math.min(100, Math.max(0, percentage))
    };
}

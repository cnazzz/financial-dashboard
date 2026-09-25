import { appState } from '../core/state.js';
import { PAYMENT_METHODS } from '../core/config.js';
import { saveTransaction, updateTransaction, deleteTransaction as deleteTransactionApi } from '../api/endpoints.js';
import { $, escapeHtml, openModal, closeModal, showLoading, hideLoading, showToast } from '../utils/dom.js';
import { formatCurrency, formatDate, toInputDate } from '../utils/format.js';

export function normalizeTransactions(items) {
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

export function populateFilterDropdowns() {
    const select = $('categoryFilter');
    if (!select) return;
    const current = appState.filters.category;
    const categories = [...new Set(appState.transactions.map(t => t.category).filter(Boolean))].sort();
    select.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(category => select.add(new Option(category, category)));
    select.value = current;
}

export function populateTransactionDropdowns() {
    const payment = $('txPayment');
    if (payment) {
        payment.innerHTML = '<option value="">Select Payment Method</option>';
        PAYMENT_METHODS.forEach(v => payment.add(new Option(v, v)));
    }

    const account = $('txAccount');
    if (account) {
        account.innerHTML = '<option value="">Select Account</option>';
        appState.accounts.forEach(a => {
            const name = a.name ?? a.account ?? '';
            if (name) account.add(new Option(name, name));
        });
    }

    populateTransactionCategories();

    const budgetCategory = $('budgetCategory');
    if (budgetCategory) {
        budgetCategory.innerHTML = '<option value="">Select Category</option>';
        [...new Set(appState.categories.map(c => c.category ?? c.name).filter(Boolean))]
            .sort()
            .forEach(v => budgetCategory.add(new Option(v, v)));
    }
}

export function populateTransactionCategories() {
    const type = $('txType')?.value || '';
    const category = $('txCategory');
    if (!category) return;
    const list = appState.categories.filter(c => !type || (c.type ?? c.Type) === type);
    const names = [...new Set(list.map(c => c.category ?? c.name).filter(Boolean))].sort();
    const current = category.value;
    category.innerHTML = '<option value="">Select Category</option>';
    names.forEach(v => category.add(new Option(v, v)));
    category.value = names.includes(current) ? current : '';
    populateSubcategories();
}

export function populateSubcategories() {
    const type = $('txType')?.value || '';
    const selected = $('txCategory')?.value || '';
    const sub = $('txSubcategory');
    if (!sub) return;
    const names = [...new Set(appState.categories
        .filter(c => (!type || (c.type ?? c.Type) === type) && (c.category ?? c.name) === selected)
        .map(c => c.subcategory ?? c.Subcategory)
        .filter(Boolean))].sort();
    sub.innerHTML = '<option value="">Select Subcategory</option>';
    names.forEach(v => sub.add(new Option(v, v)));
}

export function renderTransactionsTable() {
    const tbody = $('transactionTable');
    if (!tbody) return;
    const totalPages = Math.max(1, Math.ceil(appState.transactions.length / appState.pageSize));
    appState.currentPage = Math.min(appState.currentPage, totalPages);
    const start = (appState.currentPage - 1) * appState.pageSize;
    const rows = appState.transactions.slice(start, start + appState.pageSize);

    tbody.innerHTML = rows.length ? rows.map(t => {
        const sign = t.type === 'Expense' ? '-' : '+';
        const cls = t.type === 'Expense' ? 'negative' : '';
        return '<tr><td>' + formatDate(t.date) + '</td><td>' + escapeHtml(t.description) +
            '</td><td>' + escapeHtml(t.type) + '</td><td>' + escapeHtml(t.category) +
            '</td><td class="' + cls + '">' + sign + ' ' + formatCurrency(t.amount) +
            '</td><td>' + escapeHtml(t.account) + '</td><td><button class="btn btn-small" data-action="edit" data-id="' +
            escapeHtml(String(t.id)) + '">Edit</button> <button class="btn btn-small btn-danger" data-action="delete" data-id="' +
            escapeHtml(String(t.id)) + '">Hapus</button></td></tr>';
    }).join('') : '<tr><td colspan="7" style="text-align:center;padding:30px">Tidak ada transaksi</td></tr>';

    tbody.querySelectorAll('[data-action="edit"]').forEach(b =>
        b.addEventListener('click', () => editTransaction(b.dataset.id))
    );
    tbody.querySelectorAll('[data-action="delete"]').forEach(b =>
        b.addEventListener('click', () => deleteTransaction(b.dataset.id))
    );

    if ($('pageInfo')) $('pageInfo').textContent = 'Page ' + appState.currentPage + ' / ' + totalPages;
    if ($('prevBtn')) $('prevBtn').disabled = appState.currentPage === 1;
    if ($('nextBtn')) $('nextBtn').disabled = appState.currentPage === totalPages;
}

export function openAddTransactionModal() {
    appState.editingTransactionId = null;
    if ($('transactionModalTitle')) $('transactionModalTitle').textContent = 'Add Transaction';
    $('transactionForm')?.reset();
    const today = new Date();
    if ($('txDate')) $('txDate').valueAsDate = today;
    openModal('transactionModal');
}

export function editTransaction(id) {
    const t = appState.transactions.find(x => String(x.id) === String(id));
    if (!t) return;
    appState.editingTransactionId = t.id;
    if ($('transactionModalTitle')) $('transactionModalTitle').textContent = 'Edit Transaction';
    $('txDate').value = toInputDate(t.date);
    $('txType').value = t.type;
    populateTransactionCategories();
    $('txCategory').value = t.category;
    populateSubcategories();
    $('txSubcategory').value = t.subcategory;
    $('txDescription').value = t.description;
    $('txAmount').value = t.amount;
    $('txPayment').value = t.paymentMethod;
    $('txAccount').value = t.account;
    $('txNotes').value = t.notes;
    openModal('transactionModal');
}

export async function handleTransactionSubmit(e, reload) {
    e.preventDefault();
    if (!appState.apiUrl) return showToast('API URL belum dikonfigurasi', 'error');

    const amount = Number($('txAmount').value);
    if (!$('txDate').value || !$('txType').value || !$('txCategory').value || !amount || !$('txAccount').value) {
        return showToast('Harap isi field transaksi yang wajib', 'error');
    }

    const data = {
        date: $('txDate').value,
        type: $('txType').value,
        category: $('txCategory').value,
        subcategory: $('txSubcategory').value,
        description: $('txDescription').value.trim(),
        amount,
        paymentMethod: $('txPayment').value,
        account: $('txAccount').value,
        notes: $('txNotes').value.trim()
    };

    showLoading('Menyimpan transaksi...');
    try {
        const response = appState.editingTransactionId
            ? await updateTransaction(appState.apiUrl, appState.editingTransactionId, data)
            : await saveTransaction(appState.apiUrl, data);
        if (!response.success) throw new Error(response.error || response.message || 'Operasi gagal');
        showToast(response.message || 'Transaksi berhasil disimpan', 'success');
        closeModal('transactionModal');
        await reload();
    } catch (error) {
        showToast('Gagal menyimpan transaksi: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

export async function deleteTransaction(id, reload) {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) return;
    if (!appState.apiUrl) return showToast('API URL belum dikonfigurasi', 'error');

    showLoading('Menghapus transaksi...');
    try {
        const result = await deleteTransactionApi(appState.apiUrl, id);
        if (!result.success) throw new Error(result.error || result.message || 'Operasi gagal');
        showToast(result.message || 'Transaksi dihapus', 'success');
        await reload();
    } catch (error) {
        showToast('Gagal menghapus transaksi: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}
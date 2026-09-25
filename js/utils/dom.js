export const $ = id => document.getElementById(id);

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[ch]));
}

export function openModal(id) {
    $(id)?.classList.add('active');
}

export function closeModal(id) {
    $(id)?.classList.remove('active');
}

export function showLoading(message) {
    if ($('loadingText')) $('loadingText').textContent = message;
    $('loadingOverlay')?.classList.add('active');
}

export function hideLoading() {
    $('loadingOverlay')?.classList.remove('active');
}

export function showToast(message, type = 'success') {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => toast.classList.remove('show'), 3000);
}
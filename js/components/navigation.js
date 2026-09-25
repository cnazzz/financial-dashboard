import { $, closeModal } from '../utils/dom.js';

export function attachNavigationListeners() {
    document.querySelectorAll('.nav-item').forEach(item =>
        item.addEventListener('click', handleNavigation)
    );
}

function handleNavigation(e) {
    e.preventDefault();
    const name = e.currentTarget.dataset.section;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    e.currentTarget.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    $(name + '-section')?.classList.add('active');
    if ($('sidebar')?.classList.contains('active')) $('sidebar').classList.remove('active');
}

export function attachModalListeners() {
    ['transactionModal', 'budgetModal', 'accountModal'].forEach(id => $(id)?.addEventListener('click', e => {
        if (e.target === $(id)) closeModal(id);
    }));
}

export function toggleSidebar() {
    $('sidebar')?.classList.toggle('active');
}
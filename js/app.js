function loadDashboardData() {
    if (!API_URL) {
        showError('API URL belum dikonfigurasi. Silakan set di Pengaturan.');
        return;
    }

    showLoading('Memuat data dashboard...');
    console.log('Menghubungi server dengan POST...', API_URL);

    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Wajib text/plain
        redirect: 'follow', // Wajib untuk bypass Apps Script
        body: JSON.stringify({ action: 'getDashboardData' })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        
        console.log("Response dari Server:", data); // Cek Console browser!

        if (!data.success) {
            showError('Server merespon error: ' + data.error);
            return;
        }

        // Data berhasil ditarik murni tanpa filter
        appState.transactions = data.transactions || [];
        appState.accounts = data.accounts || [];
        appState.categories = data.categories || [];
        appState.budgets = data.budgets || [];
        appState.settings = data.settings || {};

        if (appState.transactions.length === 0) {
            showToast('Koneksi berhasil, tapi tabel transaksi terdeteksi kosong', 'warning');
        } else {
            showToast('Berhasil memuat ' + appState.transactions.length + ' transaksi!', 'success');
        }

        renderDashboard();
    })
    .catch(error => {
        hideLoading();
        console.error('Fetch Error:', error);
        showError('Gagal total menghubungi server: ' + error.message);
    });
}
# Financial Dashboard

Dashboard keuangan pribadi berbasis HTML, CSS, dan JavaScript dengan Google Apps Script sebagai API.

## Tujuan

Repository ini dirancang sebagai fondasi dashboard finansial yang mudah dikembangkan tanpa framework berat. Prioritas arsitektur:

- struktur sederhana dan mudah dipelihara;
- pemisahan state, API, perhitungan, dan UI secara bertahap;
- kompatibilitas dengan Google Apps Script API;
- konfigurasi yang tidak bergantung pada source code;
- pengembangan fitur secara incremental tanpa merusak fitur yang sudah ada.

## Struktur saat ini

```
financial-dashboard/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── package.json
├── package-lock.json
├── vercel.json
└── README.md
```

Phase 1 memperbaiki kontrak antara `index.html` dan `js/app.js`, memusatkan state aplikasi, menormalkan data transaksi, memperbaiki rendering, dan mempertahankan action API yang sudah digunakan.

## Menjalankan secara lokal

Install dependency:

```bash
npm install
```

Jalankan server development:

```bash
npm run dev
```

Kemudian buka alamat localhost yang ditampilkan oleh `http-server`.

## API

Dashboard menggunakan Google Apps Script sebagai backend. URL API dapat dimasukkan melalui Settings dan disimpan di `localStorage`.

Action API yang digunakan frontend:

- `getDashboardData`
- `saveTransaction`
- `updateTransaction`
- `deleteTransaction`

## Pengembangan berikutnya

Roadmap teknis:

1. Foundation dan konsistensi HTML/JS.
2. API client terpusat.
3. Pemisahan business logic dari rendering.
4. Component/module architecture.
5. Validation dan error handling yang lebih kuat.
6. Automated tests untuk calculation layer.
7. Performance dan accessibility.
8. Fitur finansial lanjutan seperti recurring transactions, budget analytics, dan reporting.

## Catatan

Jangan menyimpan credential atau secret API di repository. Konfigurasi pengguna disimpan di browser.

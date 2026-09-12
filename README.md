# 📦 Sistem Inventaris PPMB (Web Dashboard + WhatsApp Bot)

Sistem Manajemen Inventaris untuk Panitia Penerimaan Mahasiswa Baru (PPMB) berbasis **Node.js**, **Express**, **MySQL**, **Web Dashboard**, dan **WhatsApp Bot (Baileys)**.

---

## 🛠️ Persyaratan Lokal (Prerequisites)

Sebelum menjalankan di komputer lokal, pastikan Anda telah menginstal:
1. **Node.js** (versi 18.x atau lebih baru)
2. **MySQL Server** (bisa menggunakan XAMPP, Laragon, atau MySQL Installer)
3. HP dengan WhatsApp terinstal untuk nomor Bot (**`628113017176`**) & HP Operator (**`62895397043901`**).

---

## 🚀 Panduan Pengujian & Menjalankan di Komputer Lokal

### Langkah 1: Sesuaikan Konfigurasi Database (`.env`)
Buka file `.env` di folder utama proyek dan pastikan kredensial MySQL lokal Anda sesuai:

```ini
PORT=3000
NODE_ENV=development

# Konfigurasi Database MySQL Lokal
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=inventaris_pmb
```
*(Sesuaikan `DB_USER` dan `DB_PASSWORD` jika MySQL XAMPP/Laragon Anda menggunakan password).*

---

### Langkah 2: Inisialisasi Database & Seed Data
Pastikan Service MySQL Anda sudah berjalan, lalu buka terminal/command prompt di folder proyek dan jalankan:

```bash
npm run init-db
```

Perintah ini akan membuat database `inventaris_pmb`, tabel-tabel inventaris, serta mendaftarkan nomor operator awal Anda (`62895397043901` & `628113017176`).

---

### Langkah 3: Jalankan Aplikasi
Jalankan aplikasi dengan perintah:

```bash
npm start
```

Di terminal akan muncul pesan log:
```
🚀 [Server] Server Inventaris PPMB berjalan pada port 3000
🔗 http://localhost:3000
✅ [Database] Berhasil terhubung ke database MySQL.
🤖 [WA Bot] Menginisialisasi Baileys...
```

---

### Langkah 4: Buka Web Dashboard & Scan QR Code Bot WA
1. Buka browser dan kunjungi: **`http://localhost:3000`**
2. Klik tab **Status WA Bot & QR Code**.
3. Buka aplikasi WhatsApp di HP Bot (**`628113017176`**).
4. Masuk ke **Menu WhatsApp (Titik tiga / Pengaturan)** ➡️ **Perangkat Tertaut (Linked Devices)** ➡️ **Tautkan Perangkat (Link a Device)**.
5. Scan **QR Code** yang tampil di Web Dashboard (atau yang muncul di terminal).
6. Setelah di-scan, status di Web Dashboard akan berubah menjadi **`TERHUBUNG (CONNECTED)`**.

---

### Langkah 5: Pengujian Perintah Chat via WhatsApp
Gunakan HP Operator (**`62895397043901`**) untuk mengirimkan pesan WhatsApp ke nomor Bot (**`628113017176`**):

1. **Pengecekan Bantuan Menu:**
   * Ketik: `HELP`
2. **Pengecekan Stok Barang:**
   * Ketik: `STOK`
   * Ketik: `CEK#KAOS-MABA-L`
3. **Pencatatan Barang Masuk (Restock):**
   * Ketik: `MASUK#KAOS-MABA-L#50#Restock Pembelian Vendor A`
   * *Bot akan membalas rincian transaksi & stok terbaru.*
4. **Pencatatan Barang Keluar (Distribusi):**
   * Ketik: `KELUAR#KAOS-MABA-L#10#Distribusi Gelombang 1`
   * *Bot akan membalas rincian sisa stok.*
5. **Pengecekan Rekap Transaksi Hari Ini:**
   * Ketik: `REKAP`

---

### Langkah 6: Verifikasi Hasil di Web Dashboard
1. Buka kembali **`http://localhost:3000`**.
2. Masuk ke tab **Log Transaksi & Rekap** ➡️ Perhatikan transaksi dari WhatsApp sudah otomatis tercatat dengan badge **WA Bot**.
3. Coba tekan tombol **Export Excel (.xlsx)** untuk men-download file laporan rekap transaksi.

---

## 📁 Struktur Berkas Proyek

```
project-inventaris-pmb/
├── database/
│   └── schema.sql                 # Skema SQL DDL & Seed Data
├── public/
│   └── index.html                 # Frontend Web Dashboard Single Page
├── scripts/
│   └── initDb.js                  # Script inisialisasi database MySQL
├── src/
│   ├── config/
│   │   └── database.js            # Connection pool mysql2
│   ├── controllers/
│   │   ├── categoryController.js  # Logic CRUD Kategori
│   │   ├── exportController.js    # Logic Export Excel (.xlsx)
│   │   ├── itemController.js      # Logic CRUD Barang
│   │   ├── transactionController.js # Logic Transaksi In/Out (Atomic)
│   │   └── whitelistController.js # Logic Whitelist Operator WA
│   ├── routes/
│   │   └── api.js                 # Express REST API Routes
│   ├── wa/
│   │   ├── commandParser.js       # Parser perintah chat WA Bot
│   │   └── waClient.js            # Engine Baileys WA Client
│   └── server.js                  # Entry point Express Server
├── .env                           # Konfigurasi environment
├── package.json                   # Dependensi & NPM scripts
└── README.md                      # Panduan pengujian lokal
```

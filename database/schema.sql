-- ============================================================
-- Schema Database Inventaris PPMB (Panitia Penerimaan Maba)
-- Database: MySQL 8.0+ / MariaDB
-- ============================================================

CREATE DATABASE IF NOT EXISTS inventaris_pmb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inventaris_pmb;

-- 1. Tabel Users (Admin & Operator Web Dashboard)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'operator') DEFAULT 'operator',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Tabel Whitelisted Numbers (Nomor WA yang diizinkan bertransaksi via Bot)
CREATE TABLE IF NOT EXISTS whitelisted_numbers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL UNIQUE COMMENT 'Format E.164 tanpa tanda +, misal 628123456789',
    name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'operator') DEFAULT 'operator',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Kategori Barang
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabel Master Barang Inventaris
CREATE TABLE IF NOT EXISTS items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE COMMENT 'Kode unik barang, misal KAOS-MABA-L, TUMBLER-PROMO',
    name VARCHAR(100) NOT NULL,
    category_id INT NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'pcs' COMMENT 'pcs, pack, dus, buah',
    current_stock INT NOT NULL DEFAULT 0,
    min_stock INT NOT NULL DEFAULT 5 COMMENT 'Batas minimum alert stok',
    location VARCHAR(100) NULL COMMENT 'Lokasi penyimpanan di gudang',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 5. Tabel Log Transaksi Inventaris (Audit Trail)
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    type ENUM('IN', 'OUT') NOT NULL COMMENT 'IN = Barang Masuk, OUT = Barang Keluar',
    quantity INT NOT NULL,
    stock_before INT NOT NULL,
    stock_after INT NOT NULL,
    notes TEXT NULL COMMENT 'Keterangan/penerima/vendor',
    source ENUM('WA_BOT', 'WEB_DASHBOARD') NOT NULL DEFAULT 'WA_BOT',
    created_by_wa VARCHAR(20) NULL COMMENT 'Nomor WA penginput jika via WA',
    created_by_user_id INT NULL COMMENT 'ID User jika via Web',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Indexing untuk optimasi pencarian & rekap
CREATE INDEX idx_items_code ON items(code);
CREATE INDEX idx_transactions_created_at ON inventory_transactions(created_at);
CREATE INDEX idx_transactions_item_id ON inventory_transactions(item_id);

-- Seed Data Awal untuk Kategori
INSERT INTO categories (name, description) VALUES 
('Kit Mahasiswa Baru', 'Merchandise dan kelengkapan resmi untuk mahasiswa baru'),
('Promosi & Expo', 'Barang promosi untuk event, pameran, dan sosialisasi sekolah'),
('Atribut Panitia', 'Perlengkapan khusus panitia PPMB')
ON DUPLICATE KEY UPDATE name=name;

-- Seed Data Awal untuk Nomor WA Whitelist Operator
INSERT INTO whitelisted_numbers (phone_number, name, role) VALUES
('62895397043901', 'Operator PPMB 1 (HP)', 'admin'),
('196645077651487', 'Operator PPMB 1 (WA LID)', 'admin'),
('628113017176', 'Operator PPMB 2 / Bot HP', 'admin')
ON DUPLICATE KEY UPDATE name=name;

-- Seed Data Awal Contoh Barang
INSERT INTO items (code, name, category_id, unit, current_stock, min_stock, location) VALUES
('KAOS-MABA-L', 'Kaos Mahasiswa Baru Ukuran L', 1, 'pcs', 150, 20, 'Gudang Utama - Rak A1'),
('TUMBLER-PROMO', 'Tumbler Stainless Logo Kampus', 2, 'pcs', 50, 10, 'Gudang Utama - Rak B2'),
('STIKER-PROMO', 'Stiker Pack Promosi PPMB', 2, 'pack', 200, 30, 'Gudang Utama - Rak B3')
ON DUPLICATE KEY UPDATE code=code;

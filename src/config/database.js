const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'inventaris_pmb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

/**
 * Tes koneksi ke database MySQL saat server dinyalakan
 */
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ [Database] Berhasil terhubung ke database MySQL.');
        connection.release();
    } catch (error) {
        console.error('❌ [Database] Gagal terhubung ke database MySQL:', error.message);
        console.error('⚠️ Pastikan MySQL server berjalan dan database inventaris_pmb sudah dibuat.');
    }
}

module.exports = {
    pool,
    testConnection
};

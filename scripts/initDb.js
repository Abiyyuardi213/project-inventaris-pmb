const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDatabase() {
    console.log('🔄 Memulai inisialisasi skema database MySQL...');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true
    });

    try {
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');
        
        await connection.query(sql);
        console.log('✅ Skema database inventaris_pmb dan data awal berhasil diimpor!');
    } catch (error) {
        console.error('❌ Gagal mengimpor skema database:', error.message);
    } finally {
        await connection.end();
    }
}

initDatabase();

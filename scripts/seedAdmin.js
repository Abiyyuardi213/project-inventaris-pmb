const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedAdmin() {
    console.log('🔄 Memeriksa & membuat akun Admin default...');

    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'inventaris_pmb'
    });

    try {
        const username = 'admin';
        const rawPassword = 'adminpassword123';
        const fullName = 'Administrator PPMB';
        const role = 'admin';

        const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(rawPassword, salt);

        if (existing.length === 0) {
            await pool.query(
                'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
                [username, hash, fullName, role]
            );
            console.log(`====================================================`);
            console.log(`✅ [SEED USER] Akun Admin Berhasil Dibuat!`);
            console.log(`   Username : ${username}`);
            console.log(`   Password : ${rawPassword}`);
            console.log(`====================================================`);
        } else {
            // Update password hash jika sudah ada
            await pool.query(
                'UPDATE users SET password_hash = ?, full_name = ? WHERE username = ?',
                [hash, fullName, username]
            );
            console.log(`====================================================`);
            console.log(`✅ [SEED USER] Akun Admin Diperbarui!`);
            console.log(`   Username : ${username}`);
            console.log(`   Password : ${rawPassword}`);
            console.log(`====================================================`);
        }
    } catch (error) {
        console.error('❌ Gagal me-seed user admin:', error.message);
    } finally {
        await pool.end();
    }
}

seedAdmin();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_pmb_inventaris_2026';

/**
 * Controller Login User Admin/Operator Dashboard
 */
async function login(req, res) {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
        }

        // Cari user di database
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username.trim()]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Username atau password salah.' });
        }

        const user = users[0];

        // Verifikasi password hash
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Username atau password salah.' });
        }

        // Generate JWT Token (Berlaku 24 Jam)
        const token = jwt.sign(
            { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Login berhasil.',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    role: user.role
                }
            }
        });
    } catch (error) {
        console.error('Error login:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat login.' });
    }
}

/**
 * Get Profile User Terautentikasi
 */
async function getProfile(req, res) {
    try {
        const [users] = await pool.query(
            'SELECT id, username, full_name, role, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
        }

        res.json({ success: true, data: users[0] });
    } catch (error) {
        console.error('Error getProfile:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil profil user.' });
    }
}

module.exports = {
    login,
    getProfile
};

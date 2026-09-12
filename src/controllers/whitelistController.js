const { pool } = require('../config/database');

/**
 * Normalisasi nomor HP ke format E.164 tanpa + (misal 081234 -> 6281234)
 */
function normalizePhoneNumber(phone) {
    if (!phone) return '';
    // Ambil bagian nomor utama sebelum titik dua (:) atau at (@)
    let base = phone.split(':')[0].split('@')[0];
    let cleaned = base.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.slice(1);
    }
    return cleaned;
}

/**
 * Mendapatkan daftar nomor WA whitelist
 */
async function getWhitelistedNumbers(req, res) {
    try {
        const [rows] = await pool.query('SELECT * FROM whitelisted_numbers ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error getWhitelistedNumbers:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil nomor whitelist WA.' });
    }
}

/**
 * Menambahkan nomor WA ke Whitelist
 */
async function addWhitelistedNumber(req, res) {
    try {
        const { phone_number, name, role } = req.body;

        if (!phone_number || !name) {
            return res.status(400).json({ success: false, message: 'Nomor telepon dan nama pengelola wajib diisi.' });
        }

        const normalizedPhone = normalizePhoneNumber(phone_number);

        await pool.query(
            'INSERT INTO whitelisted_numbers (phone_number, name, role) VALUES (?, ?, ?)',
            [normalizedPhone, name.trim(), role || 'operator']
        );

        res.status(201).json({
            success: true,
            message: 'Nomor WA berhasil ditambahkan ke Whitelist.',
            data: { phone_number: normalizedPhone, name, role }
        });
    } catch (error) {
        console.error('Error addWhitelistedNumber:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Nomor WA tersebut sudah terdaftar di Whitelist.' });
        }
        res.status(500).json({ success: false, message: 'Gagal menambahkan nomor ke Whitelist.' });
    }
}

/**
 * Menghapus nomor dari Whitelist
 */
async function deleteWhitelistedNumber(req, res) {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM whitelisted_numbers WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Nomor whitelist tidak ditemukan.' });
        }

        res.json({ success: true, message: 'Nomor WA berhasil dihapus dari Whitelist.' });
    } catch (error) {
        console.error('Error deleteWhitelistedNumber:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus nomor dari Whitelist.' });
    }
}

/**
 * Cek apakah nomor WA diizinkan bertransaksi (Dipakai oleh WA Bot)
 */
async function isNumberWhitelisted(phoneNumber) {
    try {
        const normalized = normalizePhoneNumber(phoneNumber);
        const [rows] = await pool.query(
            'SELECT * FROM whitelisted_numbers WHERE phone_number = ? AND is_active = 1',
            [normalized]
        );
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('Error isNumberWhitelisted:', error);
        return null;
    }
}

module.exports = {
    getWhitelistedNumbers,
    addWhitelistedNumber,
    deleteWhitelistedNumber,
    isNumberWhitelisted,
    normalizePhoneNumber
};

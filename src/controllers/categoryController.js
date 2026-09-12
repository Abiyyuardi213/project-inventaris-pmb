const { pool } = require('../config/database');

/**
 * Mendapatkan semua daftar kategori
 */
async function getCategories(req, res) {
    try {
        const [rows] = await pool.query('SELECT * FROM categories ORDER BY name ASC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error getCategories:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data kategori.' });
    }
}

/**
 * Menambah kategori baru
 */
async function createCategory(req, res) {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi.' });
        }

        const [result] = await pool.query(
            'INSERT INTO categories (name, description) VALUES (?, ?)',
            [name, description || null]
        );

        res.status(201).json({
            success: true,
            message: 'Kategori berhasil ditambahkan.',
            data: { id: result.insertId, name, description }
        });
    } catch (error) {
        console.error('Error createCategory:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Kategori dengan nama tersebut sudah ada.' });
        }
        res.status(500).json({ success: false, message: 'Gagal menambahkan kategori.' });
    }
}

module.exports = {
    getCategories,
    createCategory
};

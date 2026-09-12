const { pool } = require('../config/database');

/**
 * Mendapatkan semua daftar barang beserta nama kategorinya
 */
async function getItems(req, res) {
    try {
        const { search, category_id, low_stock } = req.query;
        let query = `
            SELECT i.*, c.name AS category_name 
            FROM items i 
            LEFT JOIN categories c ON i.category_id = c.id 
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (i.code LIKE ? OR i.name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category_id) {
            query += ` AND i.category_id = ?`;
            params.push(category_id);
        }

        if (low_stock === 'true') {
            query += ` AND i.current_stock <= i.min_stock`;
        }

        query += ` ORDER BY i.name ASC`;

        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error getItems:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data barang.' });
    }
}

/**
 * Mendapatkan detail barang berdasarkan kode atau ID
 */
async function getItemByCodeOrId(req, res) {
    try {
        const { identifier } = req.params;
        const [rows] = await pool.query(
            `SELECT i.*, c.name AS category_name 
             FROM items i 
             LEFT JOIN categories c ON i.category_id = c.id 
             WHERE i.code = ? OR i.id = ?`,
            [identifier, identifier]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Barang tidak ditemukan.' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Error getItemByCodeOrId:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil detail barang.' });
    }
}

/**
 * Menambah barang baru
 */
async function createItem(req, res) {
    try {
        const { code, name, category_id, unit, current_stock, min_stock, location } = req.body;

        if (!code || !name || !category_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Kode barang, nama barang, dan kategori wajib diisi.' 
            });
        }

        const formattedCode = code.trim().toUpperCase();

        const [result] = await pool.query(
            `INSERT INTO items (code, name, category_id, unit, current_stock, min_stock, location) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                formattedCode, 
                name.trim(), 
                category_id, 
                unit || 'pcs', 
                current_stock || 0, 
                min_stock !== undefined ? min_stock : 5, 
                location || null
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Barang berhasil ditambahkan.',
            data: { id: result.insertId, code: formattedCode, name, current_stock: current_stock || 0 }
        });
    } catch (error) {
        console.error('Error createItem:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ 
                success: false, 
                message: `Barang dengan kode '${req.body.code}' sudah ada dalam database.` 
            });
        }
        res.status(500).json({ success: false, message: 'Gagal menambahkan barang.' });
    }
}

/**
 * Mengedit data barang
 */
async function updateItem(req, res) {
    try {
        const { id } = req.params;
        const { code, name, category_id, unit, min_stock, location } = req.body;

        const [existing] = await pool.query('SELECT * FROM items WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Barang tidak ditemukan.' });
        }

        const formattedCode = code ? code.trim().toUpperCase() : existing[0].code;

        await pool.query(
            `UPDATE items 
             SET code = ?, name = ?, category_id = ?, unit = ?, min_stock = ?, location = ? 
             WHERE id = ?`,
            [
                formattedCode,
                name !== undefined ? name.trim() : existing[0].name,
                category_id !== undefined ? category_id : existing[0].category_id,
                unit !== undefined ? unit : existing[0].unit,
                min_stock !== undefined ? min_stock : existing[0].min_stock,
                location !== undefined ? location : existing[0].location,
                id
            ]
        );

        res.json({ success: true, message: 'Data barang berhasil diperbarui.' });
    } catch (error) {
        console.error('Error updateItem:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui barang.' });
    }
}

/**
 * Menghapus barang (jika belum ada transaksi)
 */
async function deleteItem(req, res) {
    try {
        const { id } = req.params;

        // Cek apakah ada riwayat transaksi
        const [trans] = await pool.query('SELECT id FROM inventory_transactions WHERE item_id = ? LIMIT 1', [id]);
        if (trans.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Barang tidak dapat dihapus karena memiliki riwayat transaksi.' 
            });
        }

        const [result] = await pool.query('DELETE FROM items WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Barang tidak ditemukan.' });
        }

        res.json({ success: true, message: 'Barang berhasil dihapus.' });
    } catch (error) {
        console.error('Error deleteItem:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus barang.' });
    }
}

module.exports = {
    getItems,
    getItemByCodeOrId,
    createItem,
    updateItem,
    deleteItem
};

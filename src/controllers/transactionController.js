const { pool } = require('../config/database');

/**
 * Mencatat Transaksi Barang Masuk (IN) atau Keluar (OUT)
 * Menggunakan Database Transaction (Atomic Update)
 */
async function processTransaction({ item_code, type, quantity, notes, source, created_by_wa, created_by_user_id }) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const formattedCode = item_code.trim().toUpperCase();

        // 1. Ambil data barang & lock baris dengan FOR UPDATE
        const [items] = await connection.query(
            'SELECT * FROM items WHERE code = ? FOR UPDATE',
            [formattedCode]
        );

        if (items.length === 0) {
            await connection.rollback();
            return {
                success: false,
                message: `Barang dengan kode '${formattedCode}' tidak ditemukan.`
            };
        }

        const item = items[0];
        const qty = parseInt(quantity, 10);

        if (isNaN(qty) || qty <= 0) {
            await connection.rollback();
            return {
                success: false,
                message: 'Jumlah transaksi harus berupa angka bulat positif.'
            };
        }

        const stockBefore = item.current_stock;
        let stockAfter = stockBefore;

        if (type === 'IN') {
            stockAfter = stockBefore + qty;
        } else if (type === 'OUT') {
            if (stockBefore < qty) {
                await connection.rollback();
                return {
                    success: false,
                    message: `Stok tidak mencukupi! Stok '${item.name}' saat ini: ${stockBefore} ${item.unit}, diminta: ${qty} ${item.unit}.`
                };
            }
            stockAfter = stockBefore - qty;
        } else {
            await connection.rollback();
            return { success: false, message: "Tipe transaksi harus 'IN' atau 'OUT'." };
        }

        // 2. Update stok barang
        await connection.query(
            'UPDATE items SET current_stock = ? WHERE id = ?',
            [stockAfter, item.id]
        );

        // 3. Catat di log inventory_transactions
        const [transResult] = await connection.query(
            `INSERT INTO inventory_transactions 
             (item_id, type, quantity, stock_before, stock_after, notes, source, created_by_wa, created_by_user_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                item.id,
                type,
                qty,
                stockBefore,
                stockAfter,
                notes || null,
                source || 'WEB_DASHBOARD',
                created_by_wa || null,
                created_by_user_id || null
            ]
        );

        await connection.commit();

        const isLowStock = stockAfter <= item.min_stock;

        return {
            success: true,
            message: `Berhasil mencatat transaksi ${type === 'IN' ? 'Masuk' : 'Keluar'}.`,
            data: {
                transaction_id: transResult.insertId,
                item_code: item.code,
                item_name: item.name,
                unit: item.unit,
                type,
                quantity: qty,
                stock_before: stockBefore,
                stock_after: stockAfter,
                min_stock: item.min_stock,
                is_low_stock: isLowStock
            }
        };
    } catch (error) {
        await connection.rollback();
        console.error('Error processTransaction:', error);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Handler HTTP untuk REST API mencatat transaksi
 */
async function createTransaction(req, res) {
    try {
        const { item_code, type, quantity, notes } = req.body;

        if (!item_code || !type || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Parameter item_code, type (IN/OUT), dan quantity wajib diisi.'
            });
        }

        const result = await processTransaction({
            item_code,
            type,
            quantity,
            notes,
            source: 'WEB_DASHBOARD',
            created_by_user_id: req.user ? req.user.id : null
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat memproses transaksi.' });
    }
}

/**
 * Mendapatkan daftar riwayat transaksi (Audit log)
 */
async function getTransactions(req, res) {
    try {
        const { item_id, type, source, start_date, end_date, limit = 50 } = req.query;

        let query = `
            SELECT t.*, i.code AS item_code, i.name AS item_name, i.unit
            FROM inventory_transactions t
            JOIN items i ON t.item_id = i.id
            WHERE 1=1
        `;
        const params = [];

        if (item_id) {
            query += ` AND t.item_id = ?`;
            params.push(item_id);
        }

        if (type) {
            query += ` AND t.type = ?`;
            params.push(type.toUpperCase());
        }

        if (source) {
            query += ` AND t.source = ?`;
            params.push(source.toUpperCase());
        }

        if (start_date) {
            query += ` AND DATE(t.created_at) >= ?`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND DATE(t.created_at) <= ?`;
            params.push(end_date);
        }

        query += ` ORDER BY t.created_at DESC LIMIT ?`;
        params.push(parseInt(limit, 10));

        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error getTransactions:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil riwayat transaksi.' });
    }
}

/**
 * Ringkasan Statistik Dashboard
 */
async function getDashboardSummary(req, res) {
    try {
        const [totalItems] = await pool.query('SELECT COUNT(*) AS total FROM items');
        const [totalStockSum] = await pool.query('SELECT COALESCE(SUM(current_stock), 0) AS total FROM items');
        const [totalCategories] = await pool.query('SELECT COUNT(*) AS total FROM categories');
        const [lowStockItems] = await pool.query('SELECT COUNT(*) AS total FROM items WHERE current_stock <= min_stock');
        const [todayTransactions] = await pool.query(
            'SELECT COUNT(*) AS total FROM inventory_transactions WHERE DATE(created_at) = CURDATE()'
        );

        res.json({
            success: true,
            data: {
                total_items: Number(totalItems[0].total) || 0,
                total_unit_stock: Number(totalStockSum[0].total) || 0,
                total_categories: Number(totalCategories[0].total) || 0,
                low_stock_items: Number(lowStockItems[0].total) || 0,
                today_transactions: Number(todayTransactions[0].total) || 0
            }
        });
    } catch (error) {
        console.error('Error getDashboardSummary:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil statistik dashboard.' });
    }
}

/**
 * Membatalkan (Delete / Cancel) Transaksi dan Mengembalikan Stok Barang (Atomic)
 */
async function deleteTransaction(req, res) {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Ambil transaksi & lock FOR UPDATE
        const [transRows] = await connection.query(
            'SELECT * FROM inventory_transactions WHERE id = ? FOR UPDATE',
            [id]
        );

        if (transRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
        }

        const transaction = transRows[0];

        // 2. Ambil barang terkait & lock FOR UPDATE
        const [items] = await connection.query(
            'SELECT * FROM items WHERE id = ? FOR UPDATE',
            [transaction.item_id]
        );

        if (items.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Barang terkait transaksi ini tidak ditemukan.' });
        }

        const item = items[0];
        let newStock = item.current_stock;

        // Jika transaksi sebelumnya IN, pembatalan artinya mengurangi stok (stok -= quantity)
        // Jika transaksi sebelumnya OUT, pembatalan artinya mengembalikan stok (stok += quantity)
        if (transaction.type === 'IN') {
            if (item.current_stock < transaction.quantity) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Gagal membatalkan transaksi MASUK! Stok saat ini (${item.current_stock} ${item.unit}) kurang dari jumlah transaksi yang akan dibatalkan (${transaction.quantity} ${item.unit}).`
                });
            }
            newStock = item.current_stock - transaction.quantity;
        } else if (transaction.type === 'OUT') {
            newStock = item.current_stock + transaction.quantity;
        }

        // 3. Update stok barang
        await connection.query('UPDATE items SET current_stock = ? WHERE id = ?', [newStock, item.id]);

        // 4. Hapus log transaksi
        await connection.query('DELETE FROM inventory_transactions WHERE id = ?', [id]);

        await connection.commit();

        res.json({
            success: true,
            message: `Transaksi berhasil dibatalkan/dihapus! Stok '${item.name}' telah disesuaikan kembali menjadi ${newStock} ${item.unit}.`
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleteTransaction:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat membatalkan transaksi.' });
    } finally {
        connection.release();
    }
}

/**
 * Mengedit Transaksi (Jumlah, Tipe, Catatan) dengan Penyesuaian Stok Otomatis (Atomic)
 */
async function updateTransaction(req, res) {
    const { id } = req.params;
    const { type, quantity, notes } = req.body;

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Ambil transaksi lama & lock FOR UPDATE
        const [transRows] = await connection.query(
            'SELECT * FROM inventory_transactions WHERE id = ? FOR UPDATE',
            [id]
        );

        if (transRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
        }

        const oldTrans = transRows[0];
        const newQty = parseInt(quantity, 10);

        if (isNaN(newQty) || newQty <= 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Jumlah transaksi harus berupa angka positif.' });
        }

        const newType = (type || oldTrans.type).toUpperCase();
        if (newType !== 'IN' && newType !== 'OUT') {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "Tipe transaksi harus 'IN' atau 'OUT'." });
        }

        // 2. Ambil data barang & lock FOR UPDATE
        const [items] = await connection.query(
            'SELECT * FROM items WHERE id = ? FOR UPDATE',
            [oldTrans.item_id]
        );

        if (items.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Barang terkait transaksi tidak ditemukan.' });
        }

        const item = items[0];

        // 3. Revert efek transaksi lama pada stok barang
        let tempStock = item.current_stock;
        if (oldTrans.type === 'IN') {
            tempStock -= oldTrans.quantity;
        } else if (oldTrans.type === 'OUT') {
            tempStock += oldTrans.quantity;
        }

        // 4. Terapkan efek transaksi baru pada stok barang
        let finalStock = tempStock;
        if (newType === 'IN') {
            finalStock = tempStock + newQty;
        } else if (newType === 'OUT') {
            if (tempStock < newQty) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Stok tidak mencukupi untuk perubahan transaksi! Stok dasar: ${tempStock} ${item.unit}, diminta OUT: ${newQty} ${item.unit}.`
                });
            }
            finalStock = tempStock - newQty;
        }

        // 5. Update stok barang & data log transaksi
        await connection.query('UPDATE items SET current_stock = ? WHERE id = ?', [finalStock, item.id]);
        await connection.query(
            `UPDATE inventory_transactions 
             SET type = ?, quantity = ?, stock_before = ?, stock_after = ?, notes = ? 
             WHERE id = ?`,
            [newType, newQty, tempStock, finalStock, notes || null, id]
        );

        await connection.commit();

        res.json({
            success: true,
            message: `Berhasil memperbarui transaksi! Stok '${item.name}' kini ${finalStock} ${item.unit}.`
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error updateTransaction:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat memperbarui transaksi.' });
    } finally {
        connection.release();
    }
}

module.exports = {
    processTransaction,
    createTransaction,
    getTransactions,
    deleteTransaction,
    updateTransaction,
    getDashboardSummary
};

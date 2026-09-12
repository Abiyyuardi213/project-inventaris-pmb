const ExcelJS = require('exceljs');
const { pool } = require('../config/database');

/**
 * Export Log Transaksi Inventaris ke format Excel (.xlsx)
 */
async function exportTransactionsExcel(req, res) {
    try {
        const { start_date, end_date, type } = req.query;

        let query = `
            SELECT t.*, i.code AS item_code, i.name AS item_name, i.unit
            FROM inventory_transactions t
            JOIN items i ON t.item_id = i.id
            WHERE 1=1
        `;
        const params = [];

        if (start_date) {
            query += ` AND DATE(t.created_at) >= ?`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND DATE(t.created_at) <= ?`;
            params.push(end_date);
        }

        if (type) {
            query += ` AND t.type = ?`;
            params.push(type.toUpperCase());
        }

        query += ` ORDER BY t.created_at DESC`;

        const [transactions] = await pool.query(query, params);

        // Buat Workbook & Worksheet ExcelJS
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Rekap Transaksi Inventaris');

        // Style Header
        worksheet.columns = [
            { header: 'No', key: 'no', width: 6 },
            { header: 'Waktu Transaksi', key: 'created_at', width: 22 },
            { header: 'Kode Barang', key: 'item_code', width: 18 },
            { header: 'Nama Barang', key: 'item_name', width: 30 },
            { header: 'Tipe', key: 'type', width: 12 },
            { header: 'Jumlah', key: 'quantity', width: 12 },
            { header: 'Satuan', key: 'unit', width: 10 },
            { header: 'Stok Sebelum', key: 'stock_before', width: 14 },
            { header: 'Stok Sesudah', key: 'stock_after', width: 14 },
            { header: 'Sumber Input', key: 'source', width: 16 },
            { header: 'Penginput (WA/User)', key: 'operator', width: 22 },
            { header: 'Keterangan', key: 'notes', width: 35 }
        ];

        // Custom Styling Header Row
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '1E40AF' } // Dark Blue
        };

        // Isi Data
        transactions.forEach((t, index) => {
            const operator = t.source === 'WA_BOT' ? `WA: ${t.created_by_wa || '-'}` : 'Web Dashboard';
            worksheet.addRow({
                no: index + 1,
                created_at: new Date(t.created_at).toLocaleString('id-ID'),
                item_code: t.item_code,
                item_name: t.item_name,
                type: t.type === 'IN' ? 'MASUK (IN)' : 'KELUAR (OUT)',
                quantity: t.quantity,
                unit: t.unit,
                stock_before: t.stock_before,
                stock_after: t.stock_after,
                source: t.source,
                operator,
                notes: t.notes || '-'
            });
        });

        // Set Response Header untuk Download File
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="Rekap_Inventaris_PPMB_${Date.now()}.xlsx"`
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exportTransactionsExcel:', error);
        res.status(500).json({ success: false, message: 'Gagal mengeksport data ke Excel.' });
    }
}

module.exports = {
    exportTransactionsExcel
};

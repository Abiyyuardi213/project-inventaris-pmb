const { pool } = require('../config/database');
const { processTransaction } = require('../controllers/transactionController');
const { isNumberWhitelisted, normalizePhoneNumber } = require('../controllers/whitelistController');

/**
 * Modul Parser Perintah Chat WhatsApp
 * @param {string} senderJid - JID pengirim (contoh: 62895397043901@s.whatsapp.net)
 * @param {string} messageText - Isi pesan teks dari user
 */
async function parseAndExecuteCommand(senderJid, messageText) {
    // Extract nomor HP murni dari JID
    const normalizedPhone = normalizePhoneNumber(senderJid);
    console.log(`🔎 [PARSER LOG] Checking Whitelist: Raw JID=${senderJid} -> Phone=${normalizedPhone}`);

    // 1. Otorisasi Whitelist
    const operator = await isNumberWhitelisted(normalizedPhone);
    if (!operator) {
        console.log(`❌ [PARSER LOG] AKSEs DITOLAK! Nomor ${normalizedPhone} TIDAK ADA di Whitelist.`);
        return `⚠️ *AKSES DITOLAK*\nNomor Anda (+${normalizedPhone}) tidak terdaftar dalam sistem whitelisted operator PPMB.\n\nSilakan hubungi Admin untuk mendaftarkan nomor ini.`;
    }

    console.log(`✅ [PARSER LOG] AKSES DITERIMA! Operator: ${operator.name} (${operator.role})`);

    const trimmedText = messageText.trim();
    const upperText = trimmedText.toUpperCase();

    // 2. Menu Bantuan / HELP
    if (upperText === 'HELP' || upperText === 'MENU' || upperText === 'PING') {
        return getHelpMessage(operator.name);
    }

    // 3. Cek Stok Barang (Format: STOK atau CEK#KODE atau STOK#KODE)
    if (upperText === 'STOK' || upperText === 'CEK') {
        return await handleCheckAllStock();
    }
    if (upperText.startsWith('CEK#') || upperText.startsWith('STOK#')) {
        const parts = trimmedText.split('#');
        const code = parts[1] ? parts[1].trim() : '';
        return await handleCheckItemStock(code);
    }

    // 4. Barang Masuk (Format: MASUK#KODE_BARANG#JUMLAH#KETERANGAN)
    if (upperText.startsWith('MASUK#')) {
        return await handleTransactionInput('IN', trimmedText, normalizedPhone);
    }

    // 5. Barang Keluar (Format: KELUAR#KODE_BARANG#JUMLAH#KETERANGAN)
    if (upperText.startsWith('KELUAR#')) {
        return await handleTransactionInput('OUT', trimmedText, normalizedPhone);
    }

    // 6. Rekap Transaksi Hari Ini (Format: REKAP)
    if (upperText === 'REKAP') {
        return await handleTodayRecap();
    }

    // Jika format tidak dikenali
    return `❌ *Format pesan tidak dikenali.*

Ketik *HELP* atau *MENU* untuk melihat format perintah yang tersedia.`;
}

/**
 * Pesan Bantuan Menu
 */
function getHelpMessage(operatorName) {
    return `📦 *SISTEM INVENTARIS PPMB - BOT WA*
Halo, *${operatorName}*! Berikut daftar perintah yang dapat digunakan:

1️⃣ *Cek Semua Stok Barang:*
   Ketik: *STOK*

2️⃣ *Cek Stok Spesifik:*
   Ketik: *CEK#KODE_BARANG*
   _Contoh: CEK#KAOS-MABA-L_

3️⃣ *Input Barang Masuk (Restock):*
   Ketik: *MASUK#KODE_BARANG#JUMLAH#KETERANGAN*
   _Contoh: MASUK#KAOS-MABA-L#50#Pembelian Vendor A_

4️⃣ *Input Barang Keluar (Distribusi):*
   Ketik: *KELUAR#KODE_BARANG#JUMLAH#KETERANGAN*
   _Contoh: KELUAR#TUMBLER-PROMO#10#Gift Expo Maba_

5️⃣ *Rekap Transaksi Hari Ini:*
   Ketik: *REKAP*`;
}

/**
 * Menampilkan semua stok barang
 */
async function handleCheckAllStock() {
    try {
        const [items] = await pool.query(
            `SELECT i.*, c.name AS category_name 
             FROM items i 
             LEFT JOIN categories c ON i.category_id = c.id 
             ORDER BY i.name ASC`
        );

        if (items.length === 0) {
            return `📦 *DATA INVENTARIS*\nBelum ada data barang terdaftar.`;
        }

        let response = `📦 *DAFTAR STOK INVENTARIS PPMB*\n\n`;
        items.forEach((item, index) => {
            const lowStockAlert = item.current_stock <= item.min_stock ? ' ⚠️ *(STOK MENIPIS!)*' : '';
            response += `${index + 1}. *[${item.code}]* ${item.name}\n`;
            response += `   Stok: *${item.current_stock} ${item.unit}* (Min: ${item.min_stock})${lowStockAlert}\n\n`;
        });

        response += `_Gunakan MASUK#... atau KELUAR#... untuk mencatat transaksi._`;
        return response;
    } catch (error) {
        console.error('Error handleCheckAllStock:', error);
        return `❌ Gagal mengambil data stok dari database.`;
    }
}

/**
 * Menampilkan stok barang spesifik berdasarkan kode
 */
async function handleCheckItemStock(code) {
    if (!code) return `❌ Mohon masukkan kode barang. Contoh: *CEK#KAOS-MABA-L*`;

    try {
        const formattedCode = code.toUpperCase();
        const [items] = await pool.query(
            `SELECT i.*, c.name AS category_name 
             FROM items i 
             LEFT JOIN categories c ON i.category_id = c.id 
             WHERE i.code = ?`,
            [formattedCode]
        );

        if (items.length === 0) {
            return `❌ Barang dengan kode *${formattedCode}* tidak ditemukan. Ketik *STOK* untuk melihat daftar barang.`;
        }

        const item = items[0];
        const isLow = item.current_stock <= item.min_stock;

        return `🔎 *DETAIL BARANG*
*Kode:* ${item.code}
*Nama:* ${item.name}
*Kategori:* ${item.category_name || '-'}
*Stok saat ini:* *${item.current_stock} ${item.unit}*
*Stok Minimum:* ${item.min_stock} ${item.unit}
*Lokasi:* ${item.location || '-'}
${isLow ? '\n⚠️ *PERINGATAN: Stok berada di batas minimum!*' : ''}`;
    } catch (error) {
        console.error('Error handleCheckItemStock:', error);
        return `❌ Gagal mencari data barang.`;
    }
}

/**
 * Memproses transaksi MASUK atau KELUAR via WA
 */
async function handleTransactionInput(type, rawText, senderPhone) {
    const parts = rawText.split('#');
    // Format: TYPE # KODE # JUMLAH # KETERANGAN
    if (parts.length < 3) {
        return `❌ *Format Salah!*
Gunakan format:
*${type}#KODE_BARANG#JUMLAH#KETERANGAN*

_Contoh: ${type}#KAOS-MABA-L#20#Distribusi Maba Gel 1_`;
    }

    const itemCode = parts[1] ? parts[1].trim() : '';
    const quantity = parts[2] ? parts[2].trim() : '';
    const notes = parts[3] ? parts.slice(3).join('#').trim() : '';

    try {
        const result = await processTransaction({
            item_code: itemCode,
            type,
            quantity,
            notes: notes || (type === 'IN' ? 'Barang Masuk via Bot WA' : 'Barang Keluar via Bot WA'),
            source: 'WA_BOT',
            created_by_wa: senderPhone
        });

        if (!result.success) {
            return `❌ *TRANSAKSI GAGAL*\n${result.message}`;
        }

        const data = result.data;
        let response = `✅ *TRANSAKSI ${type === 'IN' ? 'MASUK' : 'KELUAR'} BERHASIL*\n\n`;
        response += `📦 *Barang:* [${data.item_code}] ${data.item_name}\n`;
        response += `🔢 *Jumlah ${type === 'IN' ? 'Masuk' : 'Keluar'}:* ${data.quantity} ${data.unit}\n`;
        response += `📊 *Stok Sebelumnya:* ${data.stock_before} ${data.unit}\n`;
        response += `📈 *Stok Sekarang:* *${data.stock_after} ${data.unit}*\n`;
        if (notes) response += `📝 *Keterangan:* ${notes}\n`;

        if (data.is_low_stock) {
            response += `\n⚠️ *PERINGATAN:* Stok barang ini tersisa *${data.stock_after} ${data.unit}* (Sudah mencapai/di bawah batas minimum ${data.min_stock} ${data.unit})!`;
        }

        return response;
    } catch (error) {
        console.error('Error handleTransactionInput:', error);
        return `❌ Terjadi kesalahan server saat memproses transaksi.`;
    }
}

/**
 * Menampilkan Rekap Transaksi Hari Ini
 */
async function handleTodayRecap() {
    try {
        const [trans] = await pool.query(
            `SELECT t.*, i.code AS item_code, i.name AS item_name, i.unit
             FROM inventory_transactions t
             JOIN items i ON t.item_id = i.id
             WHERE DATE(t.created_at) = CURDATE()
             ORDER BY t.created_at ASC`
        );

        if (trans.length === 0) {
            return `📊 *REKAP TRANSAKSI HARI INI*\nBelum ada aktivitas barang masuk atau keluar hari ini.`;
        }

        let response = `📊 *REKAP TRANSAKSI HARI INI (${new Date().toLocaleDateString('id-ID')})*\n\n`;
        
        let totalIn = 0;
        let totalOut = 0;

        trans.forEach((t, i) => {
            const typeLabel = t.type === 'IN' ? '🟢 MASUK' : '🔴 KELUAR';
            const time = new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            response += `${i + 1}. [${time}] ${typeLabel}: *${t.quantity} ${t.unit}* ${t.item_name} ([${t.item_code}])\n`;
            if (t.notes) response += `   _Ket: ${t.notes}_\n`;

            if (t.type === 'IN') totalIn += t.quantity;
            if (t.type === 'OUT') totalOut += t.quantity;
        });

        response += `\n📌 *Total Aktivitas Hari Ini:* ${trans.length} transaksi\n`;
        response += `🟢 Total Barang Masuk: *${totalIn} unit*\n`;
        response += `🔴 Total Barang Keluar: *${totalOut} unit*`;

        return response;
    } catch (error) {
        console.error('Error handleTodayRecap:', error);
        return `❌ Gagal menyusun rekap transaksi.`;
    }
}

module.exports = {
    parseAndExecuteCommand
};

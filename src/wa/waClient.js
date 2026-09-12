const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { parseAndExecuteCommand } = require('./commandParser');
const { normalizePhoneNumber } = require('../controllers/whitelistController');

let sock = null;
let latestQrCode = null;
let connectionStatus = 'DISCONNECTED'; // 'CONNECTING', 'CONNECTED', 'DISCONNECTED'
let botNumber = null;

/**
 * Mendapatkan ID pengirim yang valid (Menangani LID & Multi-Device @s.whatsapp.net)
 */
function getSenderPhoneFromMsg(msg) {
    let candidateJids = [
        msg.key?.remoteJidAlt,
        msg.key?.participant,
        msg?.participant,
        msg.key?.remoteJid
    ];

    // Priority 1: Cari JID yang berakhiran @s.whatsapp.net (Nomor HP Asli)
    for (const jid of candidateJids) {
        if (jid && jid.endsWith('@s.whatsapp.net')) {
            return normalizePhoneNumber(jid);
        }
    }

    // Priority 2: Jika tidak ada, gunakan JID mentah (LID @lid)
    for (const jid of candidateJids) {
        if (jid) {
            return normalizePhoneNumber(jid);
        }
    }

    return '';
}

/**
 * Inisialisasi WhatsApp Bot Connection (Baileys)
 */
async function initWaBot() {
    try {
        const authFolder = path.join(__dirname, '../../baileys_auth_info');
        if (!fs.existsSync(authFolder)) {
            fs.mkdirSync(authFolder, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(authFolder);
        const { version } = await fetchLatestBaileysVersion();

        console.log(`====================================================`);
        console.log(`🤖 [WA BOT LOG] Menginisialisasi Baileys v${version.join('.')}...`);
        console.log(`====================================================`);
        connectionStatus = 'CONNECTING';

        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            browser: ['Inventaris PPMB', 'Chrome', '1.0.0']
        });

        // Event: Update Creds
        sock.ev.on('creds.update', saveCreds);

        // Event: Connection Update (QR Code & Disconnect/Connect Status)
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('📱 [WA BOT LOG] QR Code baru dihasilkan! Scan dari Web Dashboard http://localhost:3000');
                try {
                    latestQrCode = await QRCode.toDataURL(qr);
                } catch (err) {
                    console.error('Gagal generate QR Data URL:', err);
                }
            }

            if (connection === 'close') {
                latestQrCode = null;
                const reason = lastDisconnect?.error?.output?.statusCode;
                const isConflict = reason === 440 || reason === DisconnectReason.connectionReplaced;
                const isLoggedOut = reason === DisconnectReason.loggedOut;
                
                connectionStatus = 'DISCONNECTED';

                if (isConflict) {
                    console.log(`⚠️ [WA BOT LOG] CONFLICT 440: Sesi terhubung di tempat lain / ada 2 proses aktif.`);
                    console.log(`⏳ Menunggu 15 detik sebelum auto-reconnect...`);
                    setTimeout(() => initWaBot(), 15000);
                } else if (!isLoggedOut) {
                    console.log(`⚠️ [WA BOT LOG] Connection Closed (Code: ${reason}). Reconnecting in 5s...`);
                    setTimeout(() => initWaBot(), 5000);
                } else {
                    console.log('❌ [WA BOT LOG] Ter-logout dari WhatsApp. Silakan scan ulang QR Code.');
                }
            } else if (connection === 'open') {
                latestQrCode = null;
                connectionStatus = 'CONNECTED';
                botNumber = sock.user ? sock.user.id.split(':')[0] : 'Unknown';
                console.log(`====================================================`);
                console.log(`✅ [WA BOT LOG] BOT ONLINE! Nomor Bot: +${botNumber}`);
                console.log(`Ready mendengarkan pesan dari operator...`);
                console.log(`====================================================`);
            }
        });

        // Event: Listener Pesan Masuk
        sock.ev.on('messages.upsert', async (m) => {
            try {
                if (m.type !== 'notify') return;

                for (const msg of m.messages) {
                    const senderJid = msg.key.remoteJid;
                    const fromMe = msg.key.fromMe;

                    // Mengambil isi teks pesan dari berbagai format WA
                    const text = msg.message?.conversation || 
                                 msg.message?.extendedTextMessage?.text || 
                                 msg.message?.imageMessage?.caption || 
                                 msg.message?.videoMessage?.caption || '';

                    const extractedPhone = getSenderPhoneFromMsg(msg);

                    console.log(`----------------------------------------------------`);
                    console.log(`📥 [PESAN DITERIMA]`);
                    console.log(`   - Raw RemoteJID: ${senderJid}`);
                    console.log(`   - msg.key      : ${JSON.stringify(msg.key)}`);
                    console.log(`   - Extracted No : ${extractedPhone}`);
                    console.log(`   - Text Pesan   : "${text}"`);
                    console.log(`   - From Me?     : ${fromMe}`);
                    console.log(`----------------------------------------------------`);

                    // Abaikan jika pesan kosong atau dari status/grup
                    if (!text) continue;
                    if (senderJid && senderJid.endsWith('@g.us')) continue;
                    if (senderJid === 'status@broadcast') continue;
                    if (fromMe) continue;

                    // Menjalankan Parser Perintah dengan Extracted Phone & Raw JID
                    console.log(`⚙️ [WA BOT LOG] Memproses perintah untuk Phone: ${extractedPhone} (JID: ${senderJid})...`);
                    const replyText = await parseAndExecuteCommand(extractedPhone || senderJid, text);

                    // Mengirimkan Balasan
                    if (replyText) {
                        await sock.sendMessage(senderJid, { text: replyText }, { quoted: msg });
                        console.log(`📤 [WA BOT LOG] Balasan BERHASIL dikirim ke ${senderJid}`);
                    }
                }
            } catch (error) {
                console.error('❌ [WA BOT ERROR] Gagal memproses messages.upsert:', error);
            }
        });

    } catch (error) {
        console.error('❌ [WA BOT ERROR] Gagal initWaBot:', error);
        connectionStatus = 'DISCONNECTED';
    }
}

/**
 * Status terkini WhatsApp Bot untuk Web Dashboard
 */
function getBotStatus() {
    return {
        status: connectionStatus,
        bot_number: botNumber,
        qr_code: latestQrCode
    };
}

module.exports = {
    initWaBot,
    getBotStatus
};

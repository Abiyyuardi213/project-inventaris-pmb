const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { initWaBot } = require('./wa/waClient');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (css, js, images)
app.use(express.static(path.join(__dirname, '../public')));

// --- Clean Page Routes (Routing Rapi per Menu Admin) ---

// Route Login: /login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Routes Menu Administrator (Semua mengarah ke index.html dengan URL Rapi)
const adminRoutes = [
    '/administrator/dashboard',
    '/administrator/wa-bot',
    '/administrator/items',
    '/administrator/transactions',
    '/administrator/whitelist'
];

app.get(adminRoutes, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Root Route: Redirect ke /administrator/dashboard
app.get('/', (req, res) => {
    res.redirect('/administrator/dashboard');
});

// API Routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server Inventaris PPMB berjalan normal.' });
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`🚀 [Server] Server Inventaris PPMB berjalan pada port ${PORT}`);
    console.log(`🔗 Login        : http://localhost:${PORT}/login`);
    console.log(`🔗 Dashboard    : http://localhost:${PORT}/administrator/dashboard`);
    console.log(`🔗 WA Bot       : http://localhost:${PORT}/administrator/wa-bot`);
    console.log(`🔗 Master Barang: http://localhost:${PORT}/administrator/items`);
    console.log(`🔗 Transaksi    : http://localhost:${PORT}/administrator/transactions`);
    console.log(`🔗 Whitelist    : http://localhost:${PORT}/administrator/whitelist`);
    
    // Inisialisasi DB & WA Bot secara asynchronous non-blocking
    testConnection().then(() => {
        initWaBot();
    }).catch(err => {
        console.error('Database connection error:', err);
    });
});

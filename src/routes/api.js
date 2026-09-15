const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const itemController = require('../controllers/itemController');
const categoryController = require('../controllers/categoryController');
const transactionController = require('../controllers/transactionController');
const whitelistController = require('../controllers/whitelistController');
const exportController = require('../controllers/exportController');
const { getBotStatus } = require('../wa/waClient');
const { verifyToken } = require('../middlewares/authMiddleware');

// --- Auth Routes (Public) ---
router.post('/auth/login', authController.login);

// --- WhatsApp Bot Status & QR (Public untuk Monitoring Web) ---
router.get('/wa/status', (req, res) => {
    res.json({ success: true, data: getBotStatus() });
});

// ================= ROUTE TERPROTEKSI (MEMBUTUHKAN JWT TOKEN) =================
router.use(verifyToken);

// User Profile
router.get('/auth/me', authController.getProfile);

// Dashboard Summary
router.get('/summary', transactionController.getDashboardSummary);

// Items Routes
router.get('/items', itemController.getItems);
router.get('/items/:identifier', itemController.getItemByCodeOrId);
router.post('/items', itemController.createItem);
router.put('/items/:id', itemController.updateItem);
router.delete('/items/:id', itemController.deleteItem);

// Categories Routes
router.get('/categories', categoryController.getCategories);
router.post('/categories', categoryController.createCategory);

// Transactions Routes
router.get('/transactions', transactionController.getTransactions);
router.post('/transactions', transactionController.createTransaction);
router.put('/transactions/:id', transactionController.updateTransaction);
router.delete('/transactions/:id', transactionController.deleteTransaction);

// Whitelist WA Numbers Routes
router.get('/whitelist', whitelistController.getWhitelistedNumbers);
router.post('/whitelist', whitelistController.addWhitelistedNumber);
router.delete('/whitelist/:id', whitelistController.deleteWhitelistedNumber);

// Export Routes
router.get('/export/transactions', exportController.exportTransactionsExcel);

module.exports = router;

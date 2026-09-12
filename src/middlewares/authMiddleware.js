const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_pmb_inventaris_2026';

/**
 * Middleware untuk memverifikasi JWT Token pada Request HTTP Header / Query
 */
function verifyToken(req, res, next) {
    let token = null;

    // 1. Ambil dari Authorization Header (Format: Bearer <token>)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    // 2. Fallback: Ambil dari Query Parameter (Khusus untuk Download Export Excel)
    if (!token && req.query && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Akses ditolak. Token autentikasi tidak ditemukan.'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Sesi login telah kadaluarsa atau token tidak valid. Silakan login kembali.'
        });
    }
}

module.exports = {
    verifyToken
};

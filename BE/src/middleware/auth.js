const jwt = require('jsonwebtoken');
const { pool } = require('../db');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return res.status(401).json({ success: false, message: 'Thiếu token đăng nhập.' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      `SELECT id, username, role, display_name, branch_name, created_at, password_updated_at, last_login_at
       FROM users WHERE id = $1 AND status = 'active' LIMIT 1`,
      [payload.userId],
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập không còn hiệu lực.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
}

function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };

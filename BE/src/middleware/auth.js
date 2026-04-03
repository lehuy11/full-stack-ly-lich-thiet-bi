const jwt = require("jsonwebtoken");
const { pool } = require("../db");

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret) {
    throw new Error("Thiếu biến môi trường JWT_SECRET.");
  }
  return secret;
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return res.status(401).json({ success: false, message: "Thiếu token đăng nhập." });
    }

    const payload = jwt.verify(token, getJwtSecret());
    const { rows } = await pool.query(
      `SELECT id, username, role, display_name, enterprise_name, branch_name, created_at, password_updated_at, last_login_at
       FROM users WHERE id = $1 AND status = 'active' LIMIT 1`,
      [payload.userId],
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ success: false, message: "Phiên đăng nhập không còn hiệu lực." });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token đã hết hạn. Vui lòng đăng nhập lại." });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Token không hợp lệ." });
    }

    console.error(error);
    return res.status(500).json({ success: false, message: "Không thể xác thực phiên đăng nhập." });
  }
}

function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Bạn chưa đăng nhập." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền thực hiện thao tác này." });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };

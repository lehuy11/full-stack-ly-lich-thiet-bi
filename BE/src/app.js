require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');
const { requireAuth, requireRole } = require('./middleware/auth');
const {
  normalizeOrganizationsTree,
  ensureOrganizationBranchStructure,
  filterOrganizationsForUser,
  mergeVisibleOrganizationsIntoFull,
} = require('./utils/tree');
const { normalizeEnterpriseName, normalizeBranchName, inferEnterpriseFromBranch } = require('./utils/organization');
const { generateUniquePassword } = require('./utils/passwords');

const app = express();
const allowedOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : true, credentials: false }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.display_name,
    enterprise: user.enterprise_name || inferEnterpriseFromBranch(user.branch_name || '') || null,
    branch: user.branch_name || null,
    createdAt: user.created_at,
    passwordUpdatedAt: user.password_updated_at,
    loginAt: user.last_login_at,
  };
}

function success(res, payload = {}, status = 200) {
  return res.status(status).json({ success: true, ...payload });
}

function failure(res, message, status = 400, extra = {}) {
  return res.status(status).json({ success: false, message, ...extra });
}

async function getBranchesTree() {
  const { rows } = await pool.query(
    'SELECT data FROM app_documents WHERE key = $1 LIMIT 1',
    ['branches_tree'],
  );
  return normalizeOrganizationsTree(Array.isArray(rows[0]?.data) ? rows[0].data : []);
}

async function saveBranchesTree(branches) {
  await pool.query(
    `INSERT INTO app_documents(key, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key)
     DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    ['branches_tree', JSON.stringify(normalizeOrganizationsTree(branches || []))],
  );
}

async function addNotification(entry) {
  await pool.query(
    `INSERT INTO notifications(
      type, title, message, branch_name, station_name, category_name,
      asset_name, asset_code, actor_name, actor_username, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11::timestamptz, NOW()))`,
    [
      entry.type || 'info',
      entry.title || 'Thông báo hệ thống',
      entry.message || '',
      entry.branchName || null,
      entry.stationName || null,
      entry.categoryName || null,
      entry.assetName || null,
      entry.assetCode || null,
      entry.actorName || null,
      entry.actorUsername || null,
      entry.createdAt || null,
    ],
  );
}

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  return success(res, { message: 'API hoạt động bình thường.' });
});

app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return failure(res, 'Tên đăng nhập và mật khẩu không được để trống.');
  }

  const { rows } = await pool.query(
    `SELECT * FROM users WHERE username = $1 AND status = 'active' LIMIT 1`,
    [username],
  );
  const user = rows[0];

  if (!user) {
    return failure(res, 'Sai tên đăng nhập hoặc mật khẩu.', 401);
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return failure(res, 'Sai tên đăng nhập hoặc mật khẩu.', 401);
  }

  const now = new Date().toISOString();
  await pool.query('UPDATE users SET last_login_at = $1 WHERE id = $2', [now, user.id]);
  user.last_login_at = now;

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '12h' });
  return success(res, {
    message: 'Đăng nhập thành công.',
    token,
    user: sanitizeUser(user),
  });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  return success(res, { user: sanitizeUser(req.user) });
});

app.post('/api/auth/logout', requireAuth, async (_req, res) => {
  return success(res, { message: 'Đăng xuất thành công.' });
});

app.get('/api/users', requireAuth, requireRole(['admin']), async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, username, role, display_name, enterprise_name, branch_name, created_at, password_updated_at, last_login_at
     FROM users WHERE status = 'active' ORDER BY username ASC`,
  );
  return success(res, { data: rows.map(sanitizeUser) });
});

app.get('/api/users/find', requireAuth, requireRole(['admin']), async (req, res) => {
  const username = String(req.query?.username || '').trim();
  if (!username) {
    return failure(res, 'Thiếu tên đăng nhập cần tìm.');
  }

  const { rows } = await pool.query(
    `SELECT id, username, role, display_name, enterprise_name, branch_name, created_at, password_updated_at, last_login_at
     FROM users WHERE username = $1 AND status = 'active' LIMIT 1`,
    [username],
  );
  const user = rows[0];
  if (!user) {
    return failure(res, 'Không tìm thấy tài khoản.', 404);
  }
  return success(res, { data: sanitizeUser(user) });
});

app.post('/api/users', requireAuth, requireRole(['admin']), async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const displayName = String(req.body?.displayName || '').trim();
  const role = req.body?.role === 'admin' ? 'admin' : 'cungtruong';
  const enterprise = role === 'admin' ? null : normalizeEnterpriseName(req.body?.enterprise || '');
  const branch = role === 'admin' ? null : normalizeBranchName(req.body?.branch || '');
  const stations = req.body?.stations;

  if (!username) return failure(res, 'Tên đăng nhập không được để trống.');
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
    return failure(res, 'Tên đăng nhập chỉ nên gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang (3-30 ký tự).');
  }
  if (!displayName) return failure(res, 'Tên hiển thị không được để trống.');
  if (role !== 'admin' && !enterprise) {
    return failure(res, 'Phải chọn xí nghiệp cho tài khoản cung trưởng.');
  }
  if (role !== 'admin' && !branch) {
    return failure(res, 'Phải chọn cung phụ trách cho tài khoản cung trưởng.');
  }

  const existingUser = await pool.query('SELECT 1 FROM users WHERE username = $1 LIMIT 1', [username]);
  if (existingUser.rowCount > 0) {
    return failure(res, 'Tên đăng nhập đã tồn tại.');
  }

  let addedStations = [];
  if (role !== 'admin') {
    const fullBranches = await getBranchesTree();
    const branchResult = ensureOrganizationBranchStructure(fullBranches, enterprise, branch, stations);
    if (!branchResult.success) {
      return failure(res, branchResult.message);
    }
    addedStations = branchResult.addedStations || [];
    await saveBranchesTree(branchResult.organizations);
  }

  const password = String(req.body?.password || '').trim() || generateUniquePassword();
  const passwordHash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    `INSERT INTO users(username, password_hash, role, display_name, enterprise_name, branch_name)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, username, role, display_name, enterprise_name, branch_name, created_at, password_updated_at, last_login_at`,
    [username, passwordHash, role, displayName, enterprise, branch],
  );

  return success(res, {
    message: 'Tạo tài khoản thành công.',
    user: sanitizeUser(rows[0]),
    password,
    addedStations,
  }, 201);
});

app.post('/api/users/:username/reset-password', requireAuth, requireRole(['admin']), async (req, res) => {
  const username = String(req.params?.username || '').trim();
  if (!username) return failure(res, 'Thiếu tài khoản cần cấp lại mật khẩu.');

  const { rows } = await pool.query(
    `SELECT id, username, role, display_name, enterprise_name, branch_name, created_at, password_updated_at, last_login_at
     FROM users WHERE username = $1 AND status = 'active' LIMIT 1`,
    [username],
  );
  const user = rows[0];
  if (!user) return failure(res, 'Không tìm thấy tài khoản cần cấp lại mật khẩu.', 404);

  const password = String(req.body?.nextPassword || '').trim() || generateUniquePassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();

  await pool.query(
    'UPDATE users SET password_hash = $1, password_updated_at = $2 WHERE username = $3',
    [passwordHash, now, username],
  );
  await pool.query(
    `UPDATE password_reset_requests
     SET status = 'resolved', resolved_at = $1, resolved_by = $2, updated_at = $1
     WHERE username = $3 AND status = 'pending'`,
    [now, req.user.username, username],
  );

  user.password_updated_at = now;

  return success(res, {
    message: 'Đã cấp lại mật khẩu.',
    password,
    user: sanitizeUser(user),
  });
});

app.get('/api/branches/tree', requireAuth, async (req, res) => {
  const branches = await getBranchesTree();
  return success(res, { data: filterOrganizationsForUser(branches, req.user) });
});

app.put('/api/branches/tree', requireAuth, requireRole(['admin', 'cungtruong']), async (req, res) => {
  const incomingBranches = Array.isArray(req.body?.branches) ? req.body.branches : [];
  const fullBranches = await getBranchesTree();
  const nextBranches = mergeVisibleOrganizationsIntoFull(fullBranches, incomingBranches, req.user);
  await saveBranchesTree(nextBranches);
  return success(res, { message: 'Đã lưu dữ liệu cây xí nghiệp/cung/ga/tài sản.', data: filterOrganizationsForUser(nextBranches, req.user) });
});

app.get('/api/password-reset-requests', requireAuth, requireRole(['admin']), async (req, res) => {
  const status = String(req.query?.status || '').trim();
  const params = [];
  let sql = `SELECT id, username, display_name, enterprise_name, branch_name, status, requested_at, resolved_at, resolved_by
             FROM password_reset_requests`;
  if (status) {
    params.push(status);
    sql += ` WHERE status = $1`;
  }
  sql += ' ORDER BY requested_at DESC';
  const { rows } = await pool.query(sql, params);
  return success(res, {
    data: rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      enterprise: row.enterprise_name,
      branch: row.branch_name,
      status: row.status,
      requestedAt: row.requested_at,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
    })),
  });
});

app.post('/api/password-reset-requests', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  if (!username) {
    return failure(res, 'Thiếu tên đăng nhập để gửi yêu cầu quên mật khẩu.');
  }

  const { rows } = await pool.query(
    `SELECT username, display_name, enterprise_name, branch_name
     FROM users WHERE username = $1 AND status = 'active' LIMIT 1`,
    [username],
  );
  const user = rows[0];
  if (!user) {
    return failure(res, 'Không tìm thấy tên đăng nhập này trong hệ thống.', 404);
  }

  const existingPending = await pool.query(
    `SELECT id, username, display_name, enterprise_name, branch_name, status, requested_at, resolved_at, resolved_by
     FROM password_reset_requests
     WHERE username = $1 AND status = 'pending'
     ORDER BY requested_at DESC
     LIMIT 1`,
    [username],
  );

  const requestedAt = new Date().toISOString();
  let created = true;
  let requestRecord;

  if (existingPending.rowCount > 0) {
    created = false;
    const pending = existingPending.rows[0];
    const { rows: updatedRows } = await pool.query(
      `UPDATE password_reset_requests
       SET display_name = $1, enterprise_name = $2, branch_name = $3, requested_at = $4, resolved_at = NULL, resolved_by = NULL, updated_at = $4
       WHERE id = $5
       RETURNING id, username, display_name, enterprise_name, branch_name, status, requested_at, resolved_at, resolved_by`,
      [user.display_name, user.enterprise_name, user.branch_name, requestedAt, pending.id],
    );
    requestRecord = updatedRows[0];
  } else {
    const { rows: insertedRows } = await pool.query(
      `INSERT INTO password_reset_requests(username, display_name, enterprise_name, branch_name, status, requested_at, updated_at)
       VALUES ($1,$2,$3,$4,'pending',$5,$5)
       RETURNING id, username, display_name, enterprise_name, branch_name, status, requested_at, resolved_at, resolved_by`,
      [user.username, user.display_name, user.enterprise_name, user.branch_name, requestedAt],
    );
    requestRecord = insertedRows[0];
  }

  await addNotification({
    type: 'password-reset-request',
    title: 'Yêu cầu quên mật khẩu',
    message: `${user.display_name || user.username} vừa gửi yêu cầu quên mật khẩu.`,
    branchName: [user.enterprise_name, user.branch_name].filter(Boolean).join(' / '),
    actorName: user.display_name,
    actorUsername: user.username,
    createdAt: requestRecord.requested_at,
  });

  return success(res, {
    created,
    request: {
      id: requestRecord.id,
      username: requestRecord.username,
      displayName: requestRecord.display_name,
      enterprise: requestRecord.enterprise_name,
      branch: requestRecord.branch_name,
      status: requestRecord.status,
      requestedAt: requestRecord.requested_at,
      resolvedAt: requestRecord.resolved_at,
      resolvedBy: requestRecord.resolved_by,
    },
  }, created ? 201 : 200);
});

app.patch('/api/password-reset-requests/:username/resolve', requireAuth, requireRole(['admin']), async (req, res) => {
  const username = String(req.params?.username || '').trim();
  if (!username) return failure(res, 'Thiếu tài khoản cần xử lý yêu cầu quên mật khẩu.');

  const now = new Date().toISOString();
  const { rows } = await pool.query(
    `UPDATE password_reset_requests
     SET status = 'resolved', resolved_at = $1, resolved_by = $2, updated_at = $1
     WHERE username = $3 AND status = 'pending'
     RETURNING id, username, display_name, enterprise_name, branch_name, status, requested_at, resolved_at, resolved_by`,
    [now, req.user.username, username],
  );

  if (!rows[0]) {
    return failure(res, 'Không còn yêu cầu quên mật khẩu đang chờ xử lý cho tài khoản này.', 404);
  }

  return success(res, {
    request: {
      id: rows[0].id,
      username: rows[0].username,
      displayName: rows[0].display_name,
      enterprise: rows[0].enterprise_name,
      branch: rows[0].branch_name,
      status: rows[0].status,
      requestedAt: rows[0].requested_at,
      resolvedAt: rows[0].resolved_at,
      resolvedBy: rows[0].resolved_by,
    },
  });
});

app.get('/api/notifications', requireAuth, requireRole(['admin']), async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, type, title, message, branch_name, station_name, category_name, asset_name, asset_code, actor_name, actor_username, created_at
     FROM notifications ORDER BY created_at DESC LIMIT 300`,
  );
  return success(res, {
    data: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      branchName: row.branch_name,
      stationName: row.station_name,
      categoryName: row.category_name,
      assetName: row.asset_name,
      assetCode: row.asset_code,
      actorName: row.actor_name,
      actorUsername: row.actor_username,
      createdAt: row.created_at,
    })),
  });
});

app.post('/api/notifications', requireAuth, requireRole(['admin', 'cungtruong']), async (req, res) => {
  const entry = {
    type: req.body?.type || 'info',
    title: req.body?.title || 'Thông báo hệ thống',
    message: req.body?.message || '',
    branchName: req.body?.branchName || null,
    stationName: req.body?.stationName || null,
    categoryName: req.body?.categoryName || null,
    assetName: req.body?.assetName || null,
    assetCode: req.body?.assetCode || null,
    actorName: req.body?.actorName || req.user.display_name,
    actorUsername: req.body?.actorUsername || req.user.username,
    createdAt: req.body?.createdAt || null,
  };

  await addNotification(entry);
  return success(res, { message: 'Đã ghi nhận thông báo.' }, 201);
});

app.delete('/api/notifications', requireAuth, requireRole(['admin']), async (_req, res) => {
  await pool.query('DELETE FROM notifications');
  return success(res, { message: 'Đã xóa toàn bộ nhật ký thông báo.' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  return failure(res, 'Đã có lỗi phía máy chủ.', 500);
});

module.exports = { app };

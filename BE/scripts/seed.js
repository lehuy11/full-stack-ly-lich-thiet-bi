require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

const DEFAULT_USERS = [
  {
    username: 'admin',
    password: 'Admin@2026',
    role: 'admin',
    displayName: 'Quản trị hệ thống',
    branch: null,
  },
  {
    username: 'saigon',
    password: 'SaiGon@2026',
    role: 'cungtruong',
    displayName: 'Cung trưởng Cung Sài Gòn',
    branch: 'Cung Sài Gòn',
  },
  {
    username: 'giaray',
    password: 'GiaRay@2026',
    role: 'cungtruong',
    displayName: 'Cung trưởng Cung Gia Ray',
    branch: 'Cung Gia Ray',
  },
  {
    username: 'longkhanh',
    password: 'LongKhanh@2026',
    role: 'cungtruong',
    displayName: 'Cung trưởng Cung Long Khánh',
    branch: 'Cung Long Khánh',
  },
  {
    username: 'trangbom',
    password: 'TrangBom@2026',
    role: 'cungtruong',
    displayName: 'Cung trưởng Cung Trảng Bom',
    branch: 'Cung Trảng Bom',
  },
  {
    username: 'songthan',
    password: 'SongThan@2026',
    role: 'cungtruong',
    displayName: 'Cung trưởng Cung Sóng Thần',
    branch: 'Cung Sóng Thần',
  },
];

async function main() {
  const seedPath = path.resolve(__dirname, '../seed-data/branches.json');
  const branches = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  await pool.query('DELETE FROM notifications');
  await pool.query('DELETE FROM password_reset_requests');
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM app_documents WHERE key = $1', ['branches_tree']);

  for (const user of DEFAULT_USERS) {
    const hash = await bcrypt.hash(user.password, 10);
    await pool.query(
      `INSERT INTO users(username, password_hash, role, display_name, branch_name)
       VALUES ($1,$2,$3,$4,$5)`,
      [user.username, hash, user.role, user.displayName, user.branch],
    );
  }

  await pool.query(
    `INSERT INTO app_documents(key, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())`,
    ['branches_tree', JSON.stringify(branches)],
  );

  console.log('Đã seed dữ liệu người dùng mặc định và cây dữ liệu thiết bị.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });

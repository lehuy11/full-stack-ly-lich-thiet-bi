require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const databaseUrl = String(process.env.DATABASE_URL || '').trim();

if (!databaseUrl) {
  throw new Error('Thiếu biến môi trường DATABASE_URL.');
}

const pool = new Pool({
  connectionString: databaseUrl,
});

async function initDatabase() {
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  await pool.query(schemaSql);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS enterprise_name VARCHAR(255)`);
  await pool.query(`ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS enterprise_name VARCHAR(255)`);
}

module.exports = { pool, initDatabase };

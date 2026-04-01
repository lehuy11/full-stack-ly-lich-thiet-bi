require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDatabase() {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS enterprise_name VARCHAR(255)`);
  await pool.query(`ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS enterprise_name VARCHAR(255)`);
}

module.exports = { pool, initDatabase };

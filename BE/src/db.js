
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function shouldUseSsl() {
  const raw = String(
    process.env.DATABASE_SSL ||
      process.env.PGSSLMODE ||
      process.env.PG_SSL ||
      "",
  )
    .trim()
    .toLowerCase();

  return ["1", "true", "require", "verify-ca", "verify-full"].includes(raw);
}

function createPool() {
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  if (!connectionString) {
    throw new Error("Thiếu biến môi trường DATABASE_URL.");
  }

  const config = { connectionString };
  if (shouldUseSsl()) {
    config.ssl = { rejectUnauthorized: false };
  }

  return new Pool(config);
}

const pool = createPool();

async function ensureSchema() {
  const schemaPath = path.resolve(__dirname, "../db/schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  await pool.query(schemaSql);
}

async function runBackwardCompatibleMigrations() {
  const statements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS enterprise_name VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`,
    `ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS enterprise_name VARCHAR(255)`,
    `ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'info'`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT 'Thông báo hệ thống'`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS branch_name VARCHAR(255)`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS station_name VARCHAR(255)`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category_name VARCHAR(255)`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS asset_name VARCHAR(255)`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS asset_code VARCHAR(255)`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_name VARCHAR(255)`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_username VARCHAR(50)`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE app_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests(status)`,
    `CREATE INDEX IF NOT EXISTS idx_password_reset_requests_username ON password_reset_requests(username)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)`,
  ];

  for (const statement of statements) {
    await pool.query(statement);
  }
}

async function initDatabase() {
  await ensureSchema();
  await runBackwardCompatibleMigrations();
}

module.exports = { pool, initDatabase };

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'cungtruong')),
  display_name VARCHAR(255) NOT NULL,
  enterprise_name VARCHAR(255),
  branch_name VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  password_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS app_documents (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL REFERENCES users(username) ON UPDATE CASCADE ON DELETE CASCADE,
  display_name VARCHAR(255) NOT NULL,
  enterprise_name VARCHAR(255),
  branch_name VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(50),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_username ON password_reset_requests(username);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  branch_name VARCHAR(255),
  station_name VARCHAR(255),
  category_name VARCHAR(255),
  asset_name VARCHAR(255),
  asset_code VARCHAR(255),
  actor_name VARCHAR(255),
  actor_username VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

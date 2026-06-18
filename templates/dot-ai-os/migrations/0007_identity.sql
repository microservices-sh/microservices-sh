-- @microservices-sh/identity schema. Apply into the app's D1 alongside other module
-- migrations (wrangler d1 migrations apply DB). Mirrors the in-memory adapters.

CREATE TABLE IF NOT EXISTS accounts (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  is_admin   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- One outstanding login code per email; the plaintext is never stored.
CREATE TABLE IF NOT EXISTS login_codes (
  email       TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

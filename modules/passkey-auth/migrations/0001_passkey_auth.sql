-- @microservices-sh/passkey-auth schema. Apply into the app's D1 alongside other
-- module migrations (wrangler d1 migrations apply DB). The module owns the canonical
-- passkey_credentials + passkey_challenges schema (mirrors the in-memory adapter).
--
-- Credentials are long-lived; challenges are short-lived and stored in D1 (the
-- target Worker has no KV binding). Public keys are stored base64url-encoded.

CREATE TABLE IF NOT EXISTS passkey_credentials (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  credential_id  TEXT NOT NULL UNIQUE,           -- base64url credential id
  public_key     TEXT NOT NULL,                  -- base64url COSE public key
  counter        INTEGER NOT NULL DEFAULT 0,     -- signature counter (clone detection)
  name           TEXT NOT NULL,                  -- human label, e.g. "Passkey 2026-06-14"
  transports     TEXT,                           -- JSON array: ["internal","hybrid",...]
  device_type    TEXT,                           -- singleDevice | multiDevice
  backed_up      INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  last_used_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user ON passkey_credentials (user_id);

CREATE TABLE IF NOT EXISTS passkey_challenges (
  challenge_key  TEXT PRIMARY KEY,               -- "reg:<userId>" or "login:<uuid>"
  challenge      TEXT NOT NULL,
  user_id        TEXT,                           -- set for registration; null for login
  created_at     INTEGER NOT NULL,
  expires_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_expires ON passkey_challenges (expires_at);

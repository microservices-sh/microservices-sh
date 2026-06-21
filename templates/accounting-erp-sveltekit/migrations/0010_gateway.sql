-- gateway module: API keys for inbound machine-to-machine access. Rate-limit
-- counters use RATE_LIMIT_KV; domain events are created by 0001_core.sql.
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  hash TEXT NOT NULL UNIQUE,
  workspace TEXT NOT NULL,
  project TEXT NOT NULL,
  subject TEXT NOT NULL,
  scopes TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(hash);

-- Gateway owns API keys for inbound machine-to-machine authentication.
-- Only the SHA-256 hash of each key is stored; the raw key is shown once at
-- creation. Rate-limit counters live in KV (RATE_LIMIT_KV), not here.
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

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(hash);
CREATE INDEX IF NOT EXISTS idx_gateway_domain_events_entity ON domain_events(entity_type, entity_id);

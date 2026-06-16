-- Idempotency owns durable records for scoped idempotency keys.
-- Downstream modules use (scope, key) to deduplicate at-least-once retries.

CREATE TABLE IF NOT EXISTS idempotency_records (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT,
  status TEXT NOT NULL,            -- in_progress | completed | failed
  response_json TEXT,
  error_json TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  status_code INTEGER,
  locked_until TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

-- Enforce exactly one live record per idempotency scope/key. Application code
-- handles expiry by replacing the row through a compare-and-swap update.
CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_scope_key
  ON idempotency_records(scope, key);

CREATE INDEX IF NOT EXISTS idx_idempotency_expiry
  ON idempotency_records(expires_at);

CREATE INDEX IF NOT EXISTS idx_idempotency_scope_status
  ON idempotency_records(scope, status);

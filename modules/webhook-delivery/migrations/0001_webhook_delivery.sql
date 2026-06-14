-- Webhook delivery owns the external endpoint registry and an append-only
-- delivery log. Secrets are per-endpoint; deliveries are never updated.
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  event_names TEXT NOT NULL DEFAULT '[]',
  secret TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  status TEXT NOT NULL,
  status_code INTEGER,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);

CREATE TABLE IF NOT EXISTS commerce_sync_connections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT,
  secret_ref TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commerce_sync_mappings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  internal_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commerce_sync_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  processed_count INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS commerce_sync_webhook_receipts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  signature TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commerce_sync_envelopes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_domain_events_entity ON domain_events(entity_type, entity_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commerce_sync_mapping_external ON commerce_sync_mappings (tenant_id, provider, resource_type, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_commerce_sync_webhook_idempotency ON commerce_sync_webhook_receipts (tenant_id, connection_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_commerce_sync_runs_connection ON commerce_sync_runs (tenant_id, connection_id, status);
CREATE INDEX IF NOT EXISTS idx_commerce_sync_envelopes_connection ON commerce_sync_envelopes (tenant_id, connection_id, resource_type, received_at);
CREATE INDEX IF NOT EXISTS idx_commerce_sync_envelopes_external ON commerce_sync_envelopes (tenant_id, connection_id, resource_type, external_id);

CREATE TABLE IF NOT EXISTS email_deliveries (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
  from_address TEXT NOT NULL,
  to_addresses TEXT NOT NULL DEFAULT '[]',
  cc_addresses TEXT NOT NULL DEFAULT '[]',
  bcc_addresses TEXT NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL,
  idempotency_key TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- domain_events is already created by 0001_core.sql (shared, compatible schema).

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_deliveries_provider_idempotency
  ON email_deliveries (provider, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_deliveries_status_created_at
  ON email_deliveries (status, created_at);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_created_at
  ON email_deliveries (created_at);

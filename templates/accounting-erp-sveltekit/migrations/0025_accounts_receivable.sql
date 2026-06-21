CREATE TABLE IF NOT EXISTS ar_customer_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL,
  reference_number TEXT,
  provider_payment_id TEXT,
  memo TEXT,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'recorded',
  received_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (amount_cents > 0)
);

CREATE TABLE IF NOT EXISTS ar_payment_applications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  payment_id TEXT NOT NULL REFERENCES ar_customer_payments(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  applied_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (amount_cents > 0)
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ar_payments_tenant_idempotency
  ON ar_customer_payments (tenant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_ar_payments_tenant_customer
  ON ar_customer_payments (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_ar_payments_tenant_received
  ON ar_customer_payments (tenant_id, received_at);
CREATE INDEX IF NOT EXISTS idx_ar_applications_tenant_payment
  ON ar_payment_applications (tenant_id, payment_id);
CREATE INDEX IF NOT EXISTS idx_ar_applications_tenant_invoice
  ON ar_payment_applications (tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_ar_applications_tenant_customer
  ON ar_payment_applications (tenant_id, customer_id);

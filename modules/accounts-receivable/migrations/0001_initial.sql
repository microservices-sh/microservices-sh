CREATE TABLE IF NOT EXISTS ar_invoice_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  due_date TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  amount_due_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (total_cents >= 0),
  CHECK (amount_paid_cents >= 0),
  CHECK (amount_due_cents >= 0),
  CHECK (status IN ('open', 'paid', 'void'))
);

CREATE TABLE IF NOT EXISTS ar_customer_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  unapplied_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL,
  reference_number TEXT,
  provider_payment_id TEXT,
  deposit_account_id TEXT,
  journal_entry_id TEXT,
  posted_at TEXT,
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
  event_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domain_events_entity ON domain_events(entity_type, entity_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ar_payments_tenant_idempotency
  ON ar_customer_payments (tenant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_ar_invoice_snapshots_tenant_customer_issued
  ON ar_invoice_snapshots (tenant_id, customer_id, issued_at);
CREATE INDEX IF NOT EXISTS idx_ar_invoice_snapshots_tenant_due
  ON ar_invoice_snapshots (tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_ar_invoice_snapshots_tenant_open_due
  ON ar_invoice_snapshots (tenant_id, due_date, customer_id)
  WHERE amount_due_cents > 0 AND status <> 'void';
CREATE INDEX IF NOT EXISTS idx_ar_invoice_snapshots_tenant_customer_open_due
  ON ar_invoice_snapshots (tenant_id, customer_id, due_date)
  WHERE amount_due_cents > 0 AND status <> 'void';
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

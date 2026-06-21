-- invoice module tables. Owned by @microservices-sh/invoice. Money is integer
-- cents; numbers are assigned atomically at issue via invoice_sequences.

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  number TEXT,                    -- assigned at issue; NULL while draft
  series TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL,           -- draft | open | paid | void
  currency TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  issued_at TEXT,
  due_at TEXT,
  paid_at TEXT,
  voided_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_overdue ON invoices(status, due_at);
-- Gapless guarantee: an issued number is unique within its series.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON invoices(series, number) WHERE number IS NOT NULL;

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_amount_cents INTEGER NOT NULL,
  tax_rate_bps INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

-- Atomic counter per series. allocate() upserts value = value + 1 RETURNING value.
CREATE TABLE IF NOT EXISTS invoice_sequences (
  series TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

-- Payment-idempotency ledger: a unique key applied at most once.
CREATE TABLE IF NOT EXISTS invoice_payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_payments_key ON invoice_payments(idempotency_key);

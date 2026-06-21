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
  payment_link_id TEXT,
  payment_link_url TEXT,
  payment_link_provider TEXT,
  payment_link_created_at TEXT,
  recurring_template_id TEXT,
  recurring_occurrence_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_overdue ON invoices(status, due_at);
-- Gapless guarantee: an issued number is unique within its series.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON invoices(series, number) WHERE number IS NOT NULL;
-- A recurring template may create at most one invoice for an occurrence.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_recurring_occurrence
  ON invoices(tenant_id, recurring_template_id, recurring_occurrence_at)
  WHERE recurring_template_id IS NOT NULL AND recurring_occurrence_at IS NOT NULL;

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

CREATE TABLE IF NOT EXISTS invoice_recurring_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  series TEXT NOT NULL,
  currency TEXT NOT NULL,
  frequency TEXT NOT NULL,
  custom_days INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  start_at TEXT NOT NULL,
  end_at TEXT,
  next_invoice_at TEXT,
  last_invoice_at TEXT,
  payment_terms_days INTEGER NOT NULL DEFAULT 14,
  max_occurrences INTEGER,
  invoices_generated INTEGER NOT NULL DEFAULT 0,
  auto_issue INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
  CHECK (status IN ('active', 'paused', 'cancelled', 'completed')),
  CHECK (payment_terms_days >= 0),
  CHECK (invoices_generated >= 0)
);

CREATE TABLE IF NOT EXISTS invoice_recurring_template_line_items (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES invoice_recurring_templates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_amount_cents INTEGER NOT NULL,
  tax_rate_bps INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_recurring_templates_next
  ON invoice_recurring_templates(tenant_id, status, next_invoice_at);
CREATE INDEX IF NOT EXISTS idx_invoice_recurring_templates_customer
  ON invoice_recurring_templates(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_recurring_lines_template
  ON invoice_recurring_template_line_items(template_id, sort_order);

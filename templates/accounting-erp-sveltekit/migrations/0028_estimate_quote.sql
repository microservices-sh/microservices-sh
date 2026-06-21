CREATE TABLE IF NOT EXISTS estimate_quotes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  quote_number TEXT NOT NULL,
  client_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'converted', 'void')),
  issue_date TEXT NOT NULL,
  expiry_date TEXT,
  sent_at TEXT,
  viewed_at TEXT,
  accepted_at TEXT,
  declined_at TEXT,
  expired_at TEXT,
  converted_at TEXT,
  voided_at TEXT,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_basis_points INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  terms TEXT,
  converted_to_invoice_id TEXT,
  pdf_key TEXT,
  created_by_id TEXT,
  updated_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, quote_number)
);

CREATE TABLE IF NOT EXISTS estimate_quote_lines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  quote_id TEXT NOT NULL REFERENCES estimate_quotes(id) ON DELETE CASCADE,
  product_id TEXT,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_estimate_quotes_tenant_status ON estimate_quotes (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_estimate_quotes_tenant_client ON estimate_quotes (tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_estimate_quotes_tenant_number ON estimate_quotes (tenant_id, quote_number);
CREATE INDEX IF NOT EXISTS idx_estimate_quotes_tenant_issue_date ON estimate_quotes (tenant_id, issue_date);
CREATE INDEX IF NOT EXISTS idx_estimate_quotes_tenant_expiry ON estimate_quotes (tenant_id, status, expiry_date);
CREATE INDEX IF NOT EXISTS idx_estimate_quote_lines_quote ON estimate_quote_lines (tenant_id, quote_id, sort_order);

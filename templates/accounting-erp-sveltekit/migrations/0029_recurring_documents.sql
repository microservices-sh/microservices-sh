CREATE TABLE IF NOT EXISTS recurring_document_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'bill')),
  party_type TEXT NOT NULL CHECK (party_type IN ('customer', 'vendor')),
  party_id TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
  custom_days INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  start_date TEXT NOT NULL,
  end_date TEXT,
  next_run_date TEXT,
  last_run_date TEXT,
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  max_occurrences INTEGER,
  occurrences_generated INTEGER NOT NULL DEFAULT 0,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_basis_points INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  terms TEXT,
  income_account_id TEXT,
  ar_account_id TEXT,
  expense_account_id TEXT,
  ap_account_id TEXT,
  auto_send INTEGER NOT NULL DEFAULT 0,
  auto_approve INTEGER NOT NULL DEFAULT 0,
  created_by_id TEXT,
  updated_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recurring_document_lines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  template_id TEXT NOT NULL REFERENCES recurring_document_templates(id) ON DELETE CASCADE,
  product_id TEXT,
  expense_account_id TEXT,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recurring_document_templates_tenant_status ON recurring_document_templates (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_recurring_document_templates_tenant_type ON recurring_document_templates (tenant_id, document_type);
CREATE INDEX IF NOT EXISTS idx_recurring_document_templates_tenant_party ON recurring_document_templates (tenant_id, party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_recurring_document_templates_tenant_due ON recurring_document_templates (tenant_id, status, next_run_date);
CREATE INDEX IF NOT EXISTS idx_recurring_document_lines_template ON recurring_document_lines (tenant_id, template_id, sort_order);

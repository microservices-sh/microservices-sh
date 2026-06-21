-- Accounts Payable owns vendors, bills, line items, payment applications, and
-- bounded recurring bill templates. Money is stored as integer cents.

CREATE TABLE IF NOT EXISTS accounts_payable_vendors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address_line_1 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  tax_id TEXT,
  is_1099_vendor INTEGER NOT NULL DEFAULT 0,
  default_expense_account_id TEXT,
  default_payment_terms_days INTEGER NOT NULL DEFAULT 30,
  currency TEXT NOT NULL DEFAULT 'USD',
  external_id TEXT,
  external_source TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts_payable_bills (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bill_number TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  vendor_bill_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  accounting_status TEXT NOT NULL DEFAULT 'unposted',
  bill_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  paid_at TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  amount_due_cents INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  ap_account_id TEXT,
  journal_entry_id TEXT,
  approved_by_id TEXT,
  approved_at TEXT,
  posted_at TEXT,
  voided_at TEXT,
  void_reason TEXT,
  recurring_template_id TEXT,
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts_payable_bill_line_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bill_id TEXT NOT NULL REFERENCES accounts_payable_bills(id) ON DELETE CASCADE,
  expense_account_id TEXT,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_amount_cents INTEGER NOT NULL DEFAULT 0,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts_payable_bill_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  payment_number TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  payment_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  unapplied_amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_account_id TEXT,
  payment_method TEXT,
  reference_number TEXT,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'posted',
  idempotency_key TEXT,
  journal_entry_id TEXT,
  posted_at TEXT,
  voided_at TEXT,
  void_reason TEXT,
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts_payable_bill_payment_applications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  payment_id TEXT NOT NULL REFERENCES accounts_payable_bill_payments(id) ON DELETE CASCADE,
  bill_id TEXT NOT NULL REFERENCES accounts_payable_bills(id),
  amount_applied_cents INTEGER NOT NULL,
  applied_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts_payable_recurring_bill_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  custom_days INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  next_bill_date TEXT NOT NULL,
  last_bill_date TEXT,
  max_occurrences INTEGER,
  bills_generated INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  auto_mark_payable INTEGER NOT NULL DEFAULT 0,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts_payable_recurring_bill_line_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  recurring_bill_template_id TEXT NOT NULL REFERENCES accounts_payable_recurring_bill_templates(id) ON DELETE CASCADE,
  expense_account_id TEXT,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_amount_cents INTEGER NOT NULL DEFAULT 0,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ap_vendors_tenant_name ON accounts_payable_vendors(tenant_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ap_vendors_tenant_external
  ON accounts_payable_vendors(tenant_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ap_bills_tenant_number ON accounts_payable_bills(tenant_id, bill_number);
CREATE INDEX IF NOT EXISTS idx_ap_bills_tenant_vendor ON accounts_payable_bills(tenant_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_ap_bills_tenant_status ON accounts_payable_bills(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ap_bills_due_date ON accounts_payable_bills(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_ap_bill_lines_bill ON accounts_payable_bill_line_items(tenant_id, bill_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ap_payments_idempotency
  ON accounts_payable_bill_payments(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ap_payments_tenant_vendor ON accounts_payable_bill_payments(tenant_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_ap_payment_apps_payment ON accounts_payable_bill_payment_applications(tenant_id, payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ap_payment_apps_unique_bill
  ON accounts_payable_bill_payment_applications(tenant_id, payment_id, bill_id);

CREATE INDEX IF NOT EXISTS idx_ap_recurring_templates_next
  ON accounts_payable_recurring_bill_templates(tenant_id, status, next_bill_date);
CREATE INDEX IF NOT EXISTS idx_ap_recurring_lines_template
  ON accounts_payable_recurring_bill_line_items(tenant_id, recurring_bill_template_id);

CREATE TABLE IF NOT EXISTS accounting_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  normal_balance TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounting_fiscal_periods (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  closed_at TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounting_journal_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  period_id TEXT NOT NULL REFERENCES accounting_fiscal_periods(id),
  entry_date TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  source_ref TEXT,
  source_type TEXT,
  posted_at TEXT,
  posted_by_id TEXT,
  voided_at TEXT,
  voided_by_id TEXT,
  void_reason TEXT,
  reversal_entry_id TEXT,
  reverses_entry_id TEXT,
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounting_journal_lines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  entry_id TEXT NOT NULL REFERENCES accounting_journal_entries(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounting_accounts(id),
  description TEXT,
  debit_cents INTEGER NOT NULL DEFAULT 0,
  credit_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (debit_cents >= 0),
  CHECK (credit_cents >= 0),
  CHECK (
    (debit_cents > 0 AND credit_cents = 0) OR
    (credit_cents > 0 AND debit_cents = 0)
  )
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_accounts_tenant_code
  ON accounting_accounts (tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_accounting_accounts_tenant_active
  ON accounting_accounts (tenant_id, active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_fiscal_periods_tenant_name
  ON accounting_fiscal_periods (tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_accounting_fiscal_periods_tenant_status
  ON accounting_fiscal_periods (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_tenant_period
  ON accounting_journal_entries (tenant_id, period_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_tenant_status
  ON accounting_journal_entries (tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_journal_entries_posted_source_ref
  ON accounting_journal_entries (tenant_id, source_ref)
  WHERE source_ref IS NOT NULL AND status IN ('posted', 'void');
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_entry
  ON accounting_journal_lines (tenant_id, entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_account
  ON accounting_journal_lines (tenant_id, account_id);

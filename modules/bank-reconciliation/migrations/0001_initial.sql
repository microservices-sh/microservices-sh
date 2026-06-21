CREATE TABLE IF NOT EXISTS bank_reconciliation_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  org_id TEXT,
  name TEXT NOT NULL,
  bank_name TEXT,
  account_mask TEXT,
  routing_number TEXT,
  account_type TEXT NOT NULL DEFAULT 'checking',
  ledger_account_id TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  opening_balance_cents INTEGER NOT NULL DEFAULT 0,
  opening_balance_date TEXT,
  current_balance_cents INTEGER NOT NULL DEFAULT 0,
  last_reconciled_balance_cents INTEGER NOT NULL DEFAULT 0,
  last_reconciled_date TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_reconciliation_imports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  org_id TEXT,
  bank_account_id TEXT NOT NULL REFERENCES bank_reconciliation_accounts(id),
  source TEXT NOT NULL DEFAULT 'csv',
  file_name TEXT,
  file_key TEXT,
  file_size INTEGER,
  source_id TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  field_mapping TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  imported_by_id TEXT,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_reconciliation_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  org_id TEXT,
  bank_account_id TEXT NOT NULL REFERENCES bank_reconciliation_accounts(id),
  statement_import_id TEXT REFERENCES bank_reconciliation_imports(id),
  transaction_date TEXT NOT NULL,
  post_date TEXT,
  description TEXT NOT NULL,
  payee TEXT,
  memo TEXT,
  check_number TEXT,
  reference_number TEXT,
  amount_cents INTEGER NOT NULL,
  transaction_type TEXT NOT NULL DEFAULT 'other',
  transaction_hash TEXT NOT NULL,
  match_status TEXT NOT NULL DEFAULT 'unmatched',
  is_manual INTEGER NOT NULL DEFAULT 0,
  reconciled INTEGER NOT NULL DEFAULT 0,
  reconciled_at TEXT,
  reconciliation_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (amount_cents <> 0)
);

CREATE TABLE IF NOT EXISTS bank_reconciliation_matches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  org_id TEXT,
  bank_transaction_id TEXT NOT NULL REFERENCES bank_reconciliation_transactions(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_ref TEXT,
  target_date TEXT,
  target_amount_cents INTEGER NOT NULL,
  description TEXT,
  match_type TEXT NOT NULL,
  confidence INTEGER,
  amount_matched_cents INTEGER NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0,
  confirmed_at TEXT,
  confirmed_by_id TEXT,
  reconciliation_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_reconciliation_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  org_id TEXT,
  bank_account_id TEXT NOT NULL REFERENCES bank_reconciliation_accounts(id),
  statement_date TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  opening_balance_cents INTEGER NOT NULL,
  statement_ending_balance_cents INTEGER NOT NULL,
  cleared_deposits_cents INTEGER NOT NULL DEFAULT 0,
  cleared_withdrawals_cents INTEGER NOT NULL DEFAULT 0,
  cleared_balance_cents INTEGER NOT NULL DEFAULT 0,
  difference_cents INTEGER NOT NULL DEFAULT 0,
  transactions_cleared INTEGER NOT NULL DEFAULT 0,
  transactions_unmatched INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  completed_at TEXT,
  completed_by_id TEXT,
  notes TEXT,
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_accounts_tenant_org
  ON bank_reconciliation_accounts (tenant_id, org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_reconciliation_accounts_ledger_account
  ON bank_reconciliation_accounts (tenant_id, ledger_account_id)
  WHERE ledger_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_imports_account
  ON bank_reconciliation_imports (tenant_id, bank_account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_reconciliation_transactions_hash
  ON bank_reconciliation_transactions (tenant_id, bank_account_id, transaction_hash);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_transactions_account_date
  ON bank_reconciliation_transactions (tenant_id, bank_account_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_transactions_match_status
  ON bank_reconciliation_transactions (tenant_id, match_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_reconciliation_matches_unique_target
  ON bank_reconciliation_matches (tenant_id, bank_transaction_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_sessions_account_status
  ON bank_reconciliation_sessions (tenant_id, bank_account_id, status);

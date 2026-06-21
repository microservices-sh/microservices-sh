CREATE TABLE IF NOT EXISTS accounting_settings (
  tenant_id TEXT PRIMARY KEY,
  accounting_standard TEXT NOT NULL DEFAULT 'gaap',
  fiscal_year_start_month INTEGER NOT NULL DEFAULT 1,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  default_ar_account_id TEXT REFERENCES accounting_accounts(id),
  default_ap_account_id TEXT REFERENCES accounting_accounts(id),
  default_income_account_id TEXT REFERENCES accounting_accounts(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (fiscal_year_start_month >= 1 AND fiscal_year_start_month <= 12)
);

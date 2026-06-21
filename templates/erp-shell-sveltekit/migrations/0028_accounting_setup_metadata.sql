ALTER TABLE accounting_accounts ADD COLUMN account_subtype TEXT;
ALTER TABLE accounting_accounts ADD COLUMN parent_id TEXT;
ALTER TABLE accounting_accounts ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE accounting_accounts ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounting_accounts ADD COLUMN is_reconcilable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounting_accounts ADD COLUMN is_header INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_accounting_accounts_tenant_parent
  ON accounting_accounts (tenant_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_accounting_accounts_tenant_reconcilable
  ON accounting_accounts (tenant_id, is_reconcilable);

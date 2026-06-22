ALTER TABLE bank_reconciliation_transactions ADD COLUMN cleared INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bank_reconciliation_transactions ADD COLUMN cleared_at TEXT;
ALTER TABLE bank_reconciliation_transactions ADD COLUMN cleared_by_id TEXT;
ALTER TABLE bank_reconciliation_transactions ADD COLUMN cleared_reconciliation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_transactions_cleared
  ON bank_reconciliation_transactions (tenant_id, bank_account_id, cleared, transaction_date);

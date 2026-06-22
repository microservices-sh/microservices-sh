ALTER TABLE accounting_settings ADD COLUMN default_deposit_account_id TEXT REFERENCES accounting_accounts(id);
ALTER TABLE accounting_settings ADD COLUMN stripe_deposit_account_id TEXT REFERENCES accounting_accounts(id);

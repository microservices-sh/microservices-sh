ALTER TABLE accounting_fiscal_periods ADD COLUMN period_type TEXT NOT NULL DEFAULT 'month';
ALTER TABLE accounting_fiscal_periods ADD COLUMN closed_by_id TEXT;

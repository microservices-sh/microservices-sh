-- Payment module owns the payments table. One row per payment intent.
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  intent_id TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

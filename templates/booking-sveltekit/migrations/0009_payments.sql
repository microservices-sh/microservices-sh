-- Payments (revamp P3b): written by the payment module's D1 repository. Deposit
-- intents are created on booking; the description links a payment to its booking
-- as 'booking:<id>'. Refunds (on cancel) flip status to 'refunded'.
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_intent_unique ON payments(intent_id);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  event_id TEXT PRIMARY KEY,
  recorded_at TEXT NOT NULL
);

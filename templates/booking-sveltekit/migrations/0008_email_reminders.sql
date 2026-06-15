-- Email + reminders (revamp P3a).
-- email_deliveries: written by the email module's D1 repository (delivery log).
CREATE TABLE IF NOT EXISTS email_deliveries (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL,
  from_address TEXT,
  to_addresses TEXT NOT NULL,
  cc_addresses TEXT,
  bcc_addresses TEXT,
  subject TEXT,
  idempotency_key TEXT,
  metadata TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_deliveries_recipient ON email_deliveries(to_addresses);

-- booking_reminders: template-owned idempotency record so a reminder is sent once.
CREATE TABLE IF NOT EXISTS booking_reminders (
  booking_id TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL
);

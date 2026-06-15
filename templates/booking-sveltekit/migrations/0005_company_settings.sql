-- Company settings (revamp P0): single 'company' row holding timezone, currency,
-- cancellation policy, reminder window, deposit %, and hold duration. These feed
-- the availability engine, reminders, and payment/cancel flows in later phases.
CREATE TABLE IF NOT EXISTS company_settings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Booking',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  currency TEXT NOT NULL DEFAULT 'USD',
  cancellation_allowed INTEGER NOT NULL DEFAULT 1,
  cancellation_notice_hours INTEGER NOT NULL DEFAULT 24,
  reminder_hours INTEGER NOT NULL DEFAULT 24,
  deposit_percent INTEGER NOT NULL DEFAULT 0,
  hold_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO company_settings (id, name, timezone, currency, created_at, updated_at)
SELECT 'company', 'Booking', 'UTC', 'USD', datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE id = 'company');

-- Availability engine (revamp P1): weekly recurring rules + date-specific
-- exceptions. Times are wall-clock in the company timezone (company_settings).
CREATE TABLE IF NOT EXISTS availability_rules (
  id TEXT PRIMARY KEY,
  service_id TEXT REFERENCES services(id),
  day_of_week INTEGER NOT NULL,       -- 0=Sun … 6=Sat
  start_time TEXT NOT NULL,           -- 'HH:MM'
  end_time TEXT NOT NULL,             -- 'HH:MM'
  buffer_minutes INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS availability_exceptions (
  id TEXT PRIMARY KEY,
  service_id TEXT REFERENCES services(id),
  date TEXT NOT NULL,                 -- 'YYYY-MM-DD'
  type TEXT NOT NULL,                 -- 'closed' | 'special_hours'
  start_time TEXT,
  end_time TEXT,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_availability_rules_day ON availability_rules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_availability_exceptions_date ON availability_exceptions(date);

-- Seed sensible defaults: Mon–Fri 09:00–17:00 for all services (service_id NULL).
INSERT INTO availability_rules (id, service_id, day_of_week, start_time, end_time, buffer_minutes, active, created_at, updated_at)
SELECT 'rule-' || d, NULL, d, '09:00', '17:00', 0, 1, datetime('now'), datetime('now')
FROM (SELECT 1 AS d UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5)
WHERE NOT EXISTS (SELECT 1 FROM availability_rules WHERE id = 'rule-' || d);

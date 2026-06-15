-- Slot holds (revamp P2): reserve a slot while a customer checks out (esp. once
-- payment lands in P3). The availability engine treats unexpired holds as taken;
-- a scheduled job deletes expired rows (see /api/holds/expire).
CREATE TABLE IF NOT EXISTS holds (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  starts_at TEXT NOT NULL,   -- ISO UTC
  ends_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,  -- ISO UTC
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_holds_service_starts ON holds(service_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_holds_expires ON holds(expires_at);

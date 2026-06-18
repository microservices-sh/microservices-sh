-- In-app notifications module owns the `notifications` table.
-- Every row is addressed to a SPECIFIC user (user_id) — this feed is never a
-- broadcast. All reads (lists, counts) MUST be scoped by user_id.
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  -- Recipient. Lists/counts are always filtered by this column.
  user_id TEXT NOT NULL,
  -- Polymorphic discriminator (e.g. "booking.confirmed", "payment.received",
  -- "mention"). The `data` column carries the per-type payload shape.
  type TEXT NOT NULL,
  -- Optional human-facing summary fields (host may render from `data` instead).
  title TEXT,
  body TEXT,
  -- JSON payload whose shape depends on `type`. Stored as text, parsed on read.
  data TEXT NOT NULL,
  -- Read/unread state. read_at is NULL while unread, set to an ISO timestamp on
  -- markRead/markAllRead. unreadCount = COUNT(*) WHERE read_at IS NULL.
  read_at TEXT,
  -- Optional idempotency key, scoped per user. A repeated (user_id, dedup_key)
  -- must NOT create a second row — enforced by the unique index below.
  dedup_key TEXT,
  created_at TEXT NOT NULL
);

-- Drives the primary user-scoped feed query (newest first).
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);

-- Accelerates unreadCount and unreadOnly listing per user.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at);

-- Idempotent notify: a (user_id, dedup_key) pair may appear at most once.
-- NULL dedup_key rows are not constrained (SQLite treats NULLs as distinct).
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_dedup ON notifications(user_id, dedup_key);

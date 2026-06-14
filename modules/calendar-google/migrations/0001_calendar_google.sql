-- Google Calendar owns OAuth tokens, per-calendar incremental sync state, active
-- push (watch) channels, and a deduplicated event cache. One row per (tenant,
-- calendar) where it makes sense; tokens are per connection.

-- OAuth tokens per connection. refresh_token is long-lived; access_token + its
-- expiry drive single-flight refresh. refresh_lock_* is the advisory lease that
-- serializes concurrent refreshes (one refresh wins, others reuse the result).
CREATE TABLE IF NOT EXISTS calendar_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT NOT NULL,
  scope TEXT,
  token_type TEXT,
  -- Absolute expiry of access_token (epoch ms).
  access_token_expires_at INTEGER NOT NULL DEFAULT 0,
  -- Single-flight refresh lease: holder id + lease expiry (epoch ms). NULL when free.
  refresh_lock_owner TEXT,
  refresh_lock_expires_at INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_tokens_conn ON calendar_tokens(tenant_id, calendar_id);

-- Incremental sync state per calendar. sync_token is Google's opaque cursor; when
-- Google returns 410 Gone it is invalidated and we full-resync (token set NULL).
CREATE TABLE IF NOT EXISTS calendar_sync_state (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  sync_token TEXT,
  last_synced_at TEXT,
  -- Count of full resyncs forced by 410 Gone (observability).
  resync_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_sync_state_conn ON calendar_sync_state(tenant_id, calendar_id);

-- Active push channels. Google watch channels expire (~7 days); we renew the ones
-- nearing expiry so sync does not silently stop. resource_id + token authenticate
-- inbound push notifications.
CREATE TABLE IF NOT EXISTS calendar_channels (
  id TEXT PRIMARY KEY,          -- our channel id (X-Goog-Channel-ID)
  tenant_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,    -- Google resource id (X-Goog-Resource-ID)
  -- Shared secret echoed back as X-Goog-Channel-Token; authenticates push callbacks.
  token TEXT NOT NULL,
  -- Channel expiry (epoch ms). Renewal targets channels within the renewal window.
  expiration INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',  -- active | stopped
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_channels_conn ON calendar_channels(tenant_id, calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendar_channels_expiry ON calendar_channels(status, expiration);

-- Event cache with dedup. (tenant, calendar, google_event_id) is unique; an event
-- arriving via both a push notification and a poll must be processed once. etag +
-- updated guard against re-processing an unchanged event.
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  google_event_id TEXT NOT NULL,
  etag TEXT,
  status TEXT NOT NULL,         -- confirmed | tentative | cancelled
  summary TEXT,
  start_at TEXT,                -- RFC3339 / date
  end_at TEXT,
  recurrence TEXT,              -- JSON array of RRULE strings, when present
  recurring_event_id TEXT,      -- set on expanded/instance events
  -- Google's per-event change cursor; skip re-processing when unchanged.
  updated TEXT,
  raw TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Dedup guarantee: at most one row per Google event id within a calendar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_event ON calendar_events(tenant_id, calendar_id, google_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_window ON calendar_events(tenant_id, calendar_id, start_at);

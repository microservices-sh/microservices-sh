-- Adds per-tenant ticket numbers, ticket threads, attachment metadata, and
-- public follow-up tokens without rewriting the already-shipped 0001 table.

ALTER TABLE support_tickets ADD COLUMN ticket_number INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS ticket_number
  FROM support_tickets
)
UPDATE support_tickets
SET ticket_number = (SELECT ranked.ticket_number FROM ranked WHERE ranked.id = support_tickets.id)
WHERE ticket_number = 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_tickets_tenant_ticket_number
  ON support_tickets(tenant_id, ticket_number);

CREATE TABLE IF NOT EXISTS support_ticket_sequences (
  tenant_id TEXT PRIMARY KEY,
  last_ticket_number INTEGER NOT NULL DEFAULT 0
);

INSERT INTO support_ticket_sequences (tenant_id, last_ticket_number)
SELECT tenant_id, MAX(ticket_number)
FROM support_tickets
GROUP BY tenant_id
ON CONFLICT(tenant_id) DO UPDATE SET
  last_ticket_number = MAX(last_ticket_number, excluded.last_ticket_number);

CREATE TABLE IF NOT EXISTS support_ticket_comments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL, -- customer | agent | system
  author_id TEXT,
  author_name TEXT,
  author_email TEXT,
  content TEXT NOT NULL,
  is_internal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_comments_ticket ON support_ticket_comments(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_ticket_comments_tenant ON support_ticket_comments(tenant_id, ticket_id);

CREATE TABLE IF NOT EXISTS support_ticket_attachments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_attachments_ticket ON support_ticket_attachments(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_ticket_attachments_tenant ON support_ticket_attachments(tenant_id, ticket_id);

CREATE TABLE IF NOT EXISTS support_ticket_share_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_share_tokens_token ON support_ticket_share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_support_ticket_share_tokens_ticket ON support_ticket_share_tokens(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_ticket_share_tokens_tenant ON support_ticket_share_tokens(tenant_id, ticket_id);

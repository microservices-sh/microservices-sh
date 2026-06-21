-- support-ticket module tables. Owned by @microservices-sh/support-ticket.
-- domain_events is already created in 0001_core; the IF NOT EXISTS guards keep
-- this idempotent. Tenant-scoped like customers and invoices.

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',     -- open | pending | resolved | closed
  priority TEXT NOT NULL DEFAULT 'normal', -- low | normal | high | urgent
  requester_email TEXT NOT NULL,
  assignee_id TEXT,                         -- NULL while unassigned
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON support_tickets(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assignee ON support_tickets(assignee_id);

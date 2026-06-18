-- org-team-rbac module tables. Every membership/role/invitation row carries its
-- org_id so all access is tenant-scoped. Owned by @microservices-sh/org-team-rbac.

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  permissions TEXT NOT NULL          -- JSON array of permission strings
);

CREATE INDEX IF NOT EXISTS idx_roles_org ON roles(org_id);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  status TEXT NOT NULL,              -- active | removed
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- One membership row per (org, user): the lookup key for tenant-scoped access.
CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_org_user ON memberships(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(org_id, status);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role_id TEXT NOT NULL,
  token TEXT NOT NULL,
  status TEXT NOT NULL,              -- pending | accepted | revoked | expired
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_org ON invitations(org_id, status);

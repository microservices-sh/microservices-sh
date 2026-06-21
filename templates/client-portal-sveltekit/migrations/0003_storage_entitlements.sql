-- @microservices-sh/storage-entitlements schema for customer storage quotas.
-- The storage-entitlements D1 adapter only reads and writes the tables below.

CREATE TABLE IF NOT EXISTS storage_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'customer', 'workspace')),
  owner_id TEXT NOT NULL,
  quota_bytes INTEGER NOT NULL DEFAULT 2147483648,
  used_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, owner_type, owner_id)
);

CREATE TABLE IF NOT EXISTS storage_packages (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  storage_bytes INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  external_product_id TEXT,
  external_price_id TEXT,
  is_popular INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS storage_purchases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'customer', 'workspace')),
  owner_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  storage_bytes INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  external_payment_id TEXT,
  external_session_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  UNIQUE (tenant_id, external_session_id)
);

CREATE TABLE IF NOT EXISTS storage_share_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'customer', 'workspace')),
  owner_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  short_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  expiry_days INTEGER NOT NULL DEFAULT 7,
  download_count INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, short_id)
);

CREATE INDEX IF NOT EXISTS idx_storage_accounts_owner ON storage_accounts (tenant_id, owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_storage_packages_active ON storage_packages (tenant_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_storage_purchases_owner ON storage_purchases (tenant_id, owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_storage_share_links_owner ON storage_share_links (tenant_id, owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_storage_share_links_short_id ON storage_share_links (tenant_id, short_id);
CREATE INDEX IF NOT EXISTS idx_storage_share_links_expires ON storage_share_links (tenant_id, expires_at);

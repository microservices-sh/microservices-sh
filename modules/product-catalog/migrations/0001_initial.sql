CREATE TABLE IF NOT EXISTS catalog_categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6B7280',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  alias TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  unit TEXT NOT NULL DEFAULT 'unit',
  product_type TEXT NOT NULL DEFAULT 'simple',
  active INTEGER NOT NULL DEFAULT 1,
  external_id TEXT,
  external_source TEXT,
  track_stock INTEGER NOT NULL DEFAULT 1,
  reorder_point REAL NOT NULL DEFAULT 0,
  reorder_quantity REAL NOT NULL DEFAULT 0,
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_category_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES catalog_categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS combo_products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  combo_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity REAL NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_sku ON products (tenant_id, sku);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_external ON products (tenant_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_tenant_active ON products (tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_products_tenant_type ON products (tenant_id, product_type);
CREATE INDEX IF NOT EXISTS idx_catalog_categories_tenant_active ON catalog_categories (tenant_id, active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_category_assignments_unique
  ON product_category_assignments (tenant_id, product_id, category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_combo_products_unique ON combo_products (tenant_id, combo_id, product_id);

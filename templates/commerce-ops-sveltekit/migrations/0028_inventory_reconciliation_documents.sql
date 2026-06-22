CREATE TABLE IF NOT EXISTS inventory_reconciliation_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL DEFAULT 'default',
  reference TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  created_by_id TEXT,
  completed_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS inventory_reconciliation_lines (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  location_id TEXT NOT NULL DEFAULT 'default',
  expected_quantity INTEGER NOT NULL DEFAULT 0 CHECK (expected_quantity >= 0),
  counted_quantity INTEGER NOT NULL DEFAULT 0 CHECK (counted_quantity >= 0),
  difference_quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'adjusted')),
  movement_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES inventory_reconciliation_documents(id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_reconciliation_documents_tenant_status
  ON inventory_reconciliation_documents (tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_inventory_reconciliation_lines_document
  ON inventory_reconciliation_lines (tenant_id, document_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_reconciliation_lines_product_location
  ON inventory_reconciliation_lines (document_id, product_id, location_id);

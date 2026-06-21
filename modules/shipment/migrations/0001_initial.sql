CREATE TABLE IF NOT EXISTS shipment_batches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shipment_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  carrier TEXT,
  tracking_number TEXT,
  notes TEXT,
  external_id TEXT,
  external_source TEXT,
  completion_ref TEXT,
  inventory_deduction_ref TEXT,
  created_by_id TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shipment_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shipment_id TEXT NOT NULL REFERENCES shipment_batches(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  product_id TEXT,
  sku TEXT,
  description TEXT NOT NULL,
  quantity REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_domain_events_entity ON domain_events(entity_type, entity_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipment_batches_tenant_number
  ON shipment_batches (tenant_id, shipment_number)
  WHERE shipment_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipment_batches_tenant_external
  ON shipment_batches (tenant_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipment_batches_tenant_completion
  ON shipment_batches (tenant_id, completion_ref)
  WHERE completion_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipment_batches_tenant_status ON shipment_batches (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_shipment_items_tenant_source ON shipment_items (tenant_id, source_type, source_id);

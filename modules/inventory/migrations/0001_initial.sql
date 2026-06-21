CREATE TABLE IF NOT EXISTS inventory_stock_movements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  location_id TEXT NOT NULL DEFAULT 'default',
  movement_type TEXT NOT NULL CHECK (
    movement_type IN ('stock_in', 'reservation', 'release', 'deduction', 'adjustment')
  ),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  on_hand_delta INTEGER NOT NULL DEFAULT 0,
  reserved_delta INTEGER NOT NULL DEFAULT 0,
  source_type TEXT,
  source_id TEXT,
  reason TEXT,
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((source_type IS NULL AND source_id IS NULL) OR (source_type IS NOT NULL AND source_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS inventory_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movements_source_ref
  ON inventory_stock_movements (tenant_id, product_id, location_id, movement_type, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_balance
  ON inventory_stock_movements (tenant_id, product_id, location_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_source
  ON inventory_stock_movements (tenant_id, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_events_tenant_created
  ON inventory_events (tenant_id, created_at);

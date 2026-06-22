CREATE TABLE IF NOT EXISTS shipment_status_transitions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shipment_id TEXT NOT NULL REFERENCES shipment_batches(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  actor_id TEXT,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shipment_status_transitions_shipment
  ON shipment_status_transitions (tenant_id, shipment_id, changed_at);

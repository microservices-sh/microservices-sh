# Inventory Use Cases

- `stockIn`: records received or added stock and increases on-hand quantity.
- `reserveStock`: creates a reservation and rejects insufficient available quantity.
- `releaseReservation`: releases reserved quantity back to available stock.
- `deductStock`: deducts shipped/consumed stock from on-hand quantity, optionally consuming reserved quantity.
- `reconcileStock`: records a count adjustment so derived on-hand quantity matches a physical count.
- `createReconciliationDocument`: snapshots counted product/location lines with expected quantities.
- `listReconciliationDocuments`: lists count documents for an operator review surface.
- `completeReconciliationDocument`: completes a document and creates line-scoped adjustment movements for differences.
- `listLowStockAlerts`: derives low-stock alerts from caller-provided product reorder points and current balances.
- `getStockBalance`: returns a balance derived from movement rows.
- `listStockMovements`: lists tenant-scoped movement rows for auditing.

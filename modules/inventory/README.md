# Inventory Module

Status: `draft`

Tenant-scoped inventory ledger with stock movements, reservations, deductions, reconciliation documents, low-stock alert read models, and balances derived from movement rows.

## Public Surface

```ts
import {
  createMemoryInventoryStore,
  createReconciliationDocument,
  completeReconciliationDocument,
  getStockBalance,
  listLowStockAlerts,
  reserveStock,
  stockIn
} from "@microservices-sh/inventory";
```

## Ownership Boundary

The module owns stock movement rows, reconciliation document headers/lines, reservation/release/deduction semantics, source-reference idempotency, derived stock balances, low-stock alert read models, inventory schemas, hooks, events, permissions, resources, and migrations.

Product identity remains owned by `product-catalog`. Inventory accepts product IDs and can use an injected product reader port, but it does not import application, template, UI, or provider code.

## Balance Model

Balances are derived from movement rows:

- `onHand = sum(onHandDelta)`
- `reserved = sum(reservedDelta)`
- `available = onHand - reserved`

Quantities are safe integer JavaScript numbers. They represent countable stock units, not money.

## Reconciliation Documents

`createReconciliationDocument` snapshots counted lines and expected on-hand quantities. `completeReconciliationDocument` turns differences into idempotent adjustment movements with `sourceType: "reconciliation-document-line"` and each line id as the source id. Matched lines do not create zero-quantity movements.

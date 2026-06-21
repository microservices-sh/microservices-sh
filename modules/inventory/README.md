# Inventory Module

Status: `draft`

Tenant-scoped inventory ledger with stock movements, reservations, deductions, reconciliation, and balances derived from movement rows.

## Public Surface

```ts
import {
  createMemoryInventoryStore,
  getStockBalance,
  reserveStock,
  stockIn
} from "@microservices-sh/inventory";
```

## Ownership Boundary

The module owns stock movement rows, reservation/release/deduction semantics, source-reference idempotency, derived stock balances, inventory schemas, hooks, events, permissions, resources, and migrations.

Product identity remains owned by `product-catalog`. Inventory accepts product IDs and can use an injected product reader port, but it does not import application, template, UI, or provider code.

## Balance Model

Balances are derived from movement rows:

- `onHand = sum(onHandDelta)`
- `reserved = sum(reservedDelta)`
- `available = onHand - reserved`

Quantities are safe integer JavaScript numbers. They represent countable stock units, not money.

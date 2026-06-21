# Shipment Module

Status: `draft`

Shipment batches and fulfillment workflow with idempotent completion and shipment events.

## Public Surface

```ts
import {
  completeShipment,
  createMemoryShipmentStore,
  createShipment
} from "@microservices-sh/shipment";
```

## Ownership Boundary

The module owns shipment batches, shipment items, external shipment references, idempotent completion references, schemas, hooks, events, permissions, resources, and migrations for `shipment`.

Templates own app shell, route adapters, UI layout, and framework-specific response mapping.

## Port Notes

This is the shipment slice from the StackSuite commerce workflow. It intentionally does not own stock balances. Completion can call an injected inventory port so stock deduction stays in the inventory module and duplicate completion attempts do not double-deduct.

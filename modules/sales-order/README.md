# Sales Order Module

Status: `draft`

Tenant-scoped sales orders with line items, external references, status transitions, reservation handoff, and invoice draft handoff.

## Public Surface

```ts
import { salesOrderModule } from "@microservices-sh/sales-order";
```

## Ownership Boundary

The module owns tenant-scoped sales order identity, line items, customer references/snapshots, external source references, integer-cent totals, status transitions, send attempt metadata, schemas, hooks, events, permissions, resources, D1/memory stores, and migrations for `sales-order`.

Templates own app shell, route adapters, UI layout, and framework-specific response mapping.

## Port Notes

`confirmOrder` can call an optional inventory reservation port. Replaying confirmation on an already confirmed order is idempotent and does not call the port again.

`markOrderInvoiced` requires an invoice draft port for the `confirmed -> invoiced` transition. Replaying the invoiced transition on an already invoiced order is idempotent and does not create another invoice draft.

`sendSalesOrder` requires a delivery port supplied by the host app. The module validates recipient/idempotency, records a send attempt, updates last-send metadata, and emits `sales-order.order_sent` or `sales-order.order_send_failed`. The module never imports email providers or stores secret values.

This module does not import inventory, invoice, SvelteKit, Hono, or external provider code.

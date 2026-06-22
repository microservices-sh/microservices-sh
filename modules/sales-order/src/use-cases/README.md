# Sales Order Use Cases

Framework-neutral use cases:

- `createDraftOrder`
- `getOrder`
- `listOrders`
- `bulkTransitionOrders`
- `confirmOrder`
- `cancelOrder`
- `sendSalesOrder`
- `markOrderInvoiced`

`bulkTransitionOrders` delegates to the single-order confirm/cancel use cases, so hooks, events, idempotency, and optional inventory reservation behavior stay in one place. It intentionally does not bulk invoice because invoice creation is a financial-document side effect.

Inventory reservation, invoice draft creation, and sales-order delivery are optional ports. Do not import inventory, invoice, email, SvelteKit, Hono, provider clients, or secret values directly in use cases.

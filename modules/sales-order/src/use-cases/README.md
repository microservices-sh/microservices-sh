# Sales Order Use Cases

Framework-neutral use cases:

- `createDraftOrder`
- `getOrder`
- `listOrders`
- `confirmOrder`
- `cancelOrder`
- `sendSalesOrder`
- `markOrderInvoiced`

Inventory reservation, invoice draft creation, and sales-order delivery are optional ports. Do not import inventory, invoice, email, SvelteKit, Hono, provider clients, or secret values directly in use cases.

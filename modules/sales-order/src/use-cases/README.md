# Sales Order Use Cases

Framework-neutral use cases:

- `createDraftOrder`
- `getOrder`
- `listOrders`
- `confirmOrder`
- `cancelOrder`
- `markOrderInvoiced`

Inventory reservation and invoice draft creation are optional ports. Do not import inventory, invoice, SvelteKit, Hono, provider clients, or secret values directly in use cases.

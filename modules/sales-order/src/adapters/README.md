# Sales Order Adapters

- `memory-sales-order-store.ts` is the fast unit-test store.
- `d1-sales-order-store.ts` is the Cloudflare D1 store behind the same port.

Inventory reservation and invoice draft creation are ports, not adapters owned by this module. Host apps can supply those integrations without making sales-order import inventory, invoice, framework, or provider code.

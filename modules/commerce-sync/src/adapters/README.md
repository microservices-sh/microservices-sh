# Commerce Sync Adapters

Adapters live behind the `CommerceSyncStore` port from `src/ports`.

- `memory-commerce-sync-store.ts` is the reference in-memory store for tests and local runtimes.
- `d1-commerce-sync-store.ts` persists the full port to Cloudflare D1, including normalized commerce envelopes.
- Webhook receipt payloads and normalized envelope payloads are stored as JSON text.

Keep provider side effects behind explicit function calls.

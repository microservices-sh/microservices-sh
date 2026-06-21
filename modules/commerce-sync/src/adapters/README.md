# Commerce Sync Adapters

Adapters live behind the `CommerceSyncStore` port from `src/ports`.

- `memory-commerce-sync-store.ts` is the reference in-memory store for tests and local runtimes.
- D1 is not implemented yet because `migrations/0001_initial.sql` does not include a table for persisted normalized
  commerce envelopes. The current service API writes `NormalizedCommerceEnvelope` records through
  `normalizeCommercePayload`, so a D1 adapter needs a verified envelope table or follow-up migration before it can
  satisfy the full port.

Keep provider side effects behind explicit function calls.

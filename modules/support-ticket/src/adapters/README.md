# Support Ticket Adapters

Adapters provided:

- `createMemoryTicketStore()` for tests and local demo flows.
- `createD1TicketStore(db)` for Cloudflare D1 persistence.

Both adapters implement tickets, per-tenant sequence numbers, comments, attachment metadata, and share tokens.

Attachment records store `storageKey` metadata only. Upload streaming, R2 object writes, signed URLs, MIME validation, and file-size limits belong in host route adapters or a storage module.

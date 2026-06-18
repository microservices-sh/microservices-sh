# Agent Guide: Support Ticket Module

Read `module.json`, `llms.txt`, and `src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral. Do not import SvelteKit, Hono, or app route
   code from `src/use-cases`, `src/ports`, `src/adapters`, or `src/service`.
2. Put persistence behind the `TicketStore` port. Never make real I/O in tests -
   use `createMemoryTicketStore()`.
3. Put Cloudflare D1 behavior in `src/adapters/d1-ticket-store.ts`.
4. Every use case returns `ok()/err()` from `@microservices-sh/connection-contract`
   with a `Meta` built by `supportTicketMeta` (correlationId threading).
5. Preserve the event contract:
   - `createTicket` emits `support-ticket.created`.
   - `updateTicket` emits `support-ticket.updated`, and additionally
     `support-ticket.status_changed` whenever the status transitions.
6. All lookups/listing are tenant-scoped (`tenantId`).
7. Risk `medium`: migrations, PII fields, external side effects, and production
   deploy are approval-gated.
8. Run `pnpm --filter @microservices-sh/support-ticket build`, `check:spec`, and
   `test` after edits.

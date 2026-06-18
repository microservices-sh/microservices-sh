# Support Ticket Module

Status: `available` (v0.1.0) | Class: `core` | Risk: `medium`

Tenant-scoped support tickets for Cloudflare Workers + D1. Powers the ERP /
help-desk template surface. A ticket moves through an enforced status lifecycle
and carries a priority and an optional assignee.

- **Lifecycle**: `open -> pending -> resolved -> closed` (status enum; default `open`).
- **Priority**: `low | normal | high | urgent` (default `normal`).
- **Tenant-scoped**: every lookup and listing is filtered by `tenantId`.
- **Eventful**: `createTicket` emits `support-ticket.created`; `updateTicket`
  emits `support-ticket.updated` plus `support-ticket.status_changed` when the
  status actually transitions.

## Public Surface

```ts
import {
  createTicket, getTicket, listTickets, updateTicket,
  createD1TicketStore, createMemoryTicketStore
} from "@microservices-sh/support-ticket";

import type { TicketStore } from "@microservices-sh/support-ticket/ports";
```

Every use case returns the shared `ok()/err()` Result envelope from
`@microservices-sh/connection-contract`, with `meta` carrying a threaded
`correlationId`.

```ts
const store = createD1TicketStore(env.DB);

const created = await createTicket(
  { tenantId, subject: "Login fails", description: "...", requesterEmail: "a@b.com" },
  { store }
);
await updateTicket({ id: created.data.ticket.id, status: "resolved" }, { store });
```

## Ownership Boundary

The module owns: ticket use cases, the `TicketStore` port, D1 and memory adapters,
schemas/types, hooks and events, and the D1 migration for `support_tickets`.

Templates own: app shell, route adapters, UI layout, framework-specific response
mapping, and local wiring to Cloudflare bindings.

## Resources

- D1 (`DB`): `support_tickets`, `domain_events` (migration `0001_support_ticket.sql`).

## Verification

```bash
pnpm --filter @microservices-sh/support-ticket build
pnpm --filter @microservices-sh/support-ticket check:spec
pnpm --filter @microservices-sh/support-ticket test
```

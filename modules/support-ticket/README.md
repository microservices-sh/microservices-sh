# Support Ticket Module

Status: `available` (v0.1.0) | Class: `core` | Risk: `medium`

Tenant-scoped support tickets for Cloudflare Workers + D1. Powers the ERP /
help-desk template surface. A ticket moves through an enforced status lifecycle
and carries a per-tenant ticket number, priority, optional assignee, comments,
attachment metadata, and optional public follow-up links.

- **Lifecycle**: `open -> pending -> resolved -> closed` (status enum; default `open`).
- **Priority**: `low | normal | high | urgent` (default `normal`).
- **Ticket numbers**: per-tenant sequence values assigned by the store.
- **Thread**: public/customer comments, internal notes, and attachment metadata.
- **Follow-up links**: share tokens with active/expired state and public snapshots.
- **Tenant-scoped**: every lookup and listing is filtered by `tenantId`.
- **Eventful**: `createTicket` emits `support-ticket.created`; `updateTicket`
  emits `support-ticket.updated` plus `support-ticket.status_changed` when the
  status actually transitions. Comment, attachment, and share-token writes emit
  dedicated events.

## Public Surface

```ts
import {
  addTicketComment,
  attachTicketFile,
  createTicket,
  createTicketShareToken,
  getTicket,
  listTicketThread,
  listTickets,
  resolveTicketShareToken,
  updateTicket,
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
await addTicketComment(
  { ticketId: created.data.ticket.id, authorType: "agent", content: "Resolved by resetting MFA." },
  { store }
);
```

## Ownership Boundary

The module owns: ticket use cases, the `TicketStore` port, D1 and memory adapters,
schemas/types, hooks and events, and D1 migrations for tickets, sequences,
comments, attachment metadata, share tokens, and domain events.

Templates own: app shell, route adapters, UI layout, framework-specific response
mapping, auth, upload streaming, R2/signed URL handling, file-size/MIME policy,
email notifications, and local wiring to Cloudflare bindings.

The StackSuite HelpGrid donor also includes pending upload sessions, R2 byte
streaming routes, AI analyses/follow-up questions, billing tokens, and WhatsApp
channel behavior. Those are intentionally excluded here; this module stores the
durable support-ticket records that those route adapters can reference.

## Resources

- D1 (`DB`): `support_tickets`, `support_ticket_sequences`,
  `support_ticket_comments`, `support_ticket_attachments`,
  `support_ticket_share_tokens`, `domain_events`
  (base migration `0001_support_ticket.sql`; thread/share-token upgrade
  `0002_ticket_thread_share_tokens.sql`).

## Verification

```bash
pnpm --filter @microservices-sh/support-ticket build
pnpm --filter @microservices-sh/support-ticket check:spec
pnpm --filter @microservices-sh/support-ticket test
```

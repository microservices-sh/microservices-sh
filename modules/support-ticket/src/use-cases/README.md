# Support Ticket Use Cases

Framework-neutral use cases:

- `createTicket`
- `getTicket`
- `listTickets`
- `updateTicket`
- `addTicketComment`
- `listTicketThread`
- `attachTicketFile`
- `createTicketShareToken`
- `listTicketShareTokens`
- `revokeTicketShareToken`
- `resolveTicketShareToken`

Scoped wrappers in `scoped.ts` enforce `AuthContext.orgId` before tenant-sensitive mutations and reads.

Do not import SvelteKit, Hono, provider clients, upload clients, email clients, or secret values directly in use cases.

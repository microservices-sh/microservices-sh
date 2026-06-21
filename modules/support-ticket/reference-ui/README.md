# Support Ticket Reference UI

Reference UI is optional host-app code. The module owns ticket sequence numbers, lifecycle, assignment, comments, attachment metadata, share tokens, and ticket events.

Admin surface:
- List tickets, filter by status/priority, show `#ticketNumber`, inspect thread details, assign owners, and update status.
- Add customer-visible replies and internal notes with separate controls.
- Show attachment metadata and signed download links supplied by the host app.
- Create/revoke public follow-up links from an explicit approval-gated action.
- Gate reads with `support.read`; gate triage and mutation with `support.manage`.

Visitor surface:
- Create a ticket, view ticket status, and add customer-visible replies when identity or a valid share token is available.
- Use the visitor feature key `support`.

Agentic surface:
- Prefer triage summaries and suggested replies before mutation.
- Require approval before customer-visible replies, public follow-up links, status changes, assignment, or escalation.

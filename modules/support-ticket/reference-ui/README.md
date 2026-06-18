# Support Ticket Reference UI

Reference UI is optional host-app code. The module owns ticket lifecycle, assignment, comments, and ticket events.

Admin surface:
- List tickets, filter by status/priority, inspect details, assign owners, and update status.
- Gate reads with `support.read`; gate triage and mutation with `support.manage`.

Visitor surface:
- Create a ticket, view ticket status, and add customer-visible replies when identity is available.
- Use the visitor feature key `support`.

Agentic surface:
- Prefer triage summaries and suggested replies before mutation.
- Require approval before customer-visible replies, status changes, assignment, or escalation.

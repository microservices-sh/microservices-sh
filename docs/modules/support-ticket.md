# Support Ticket

Status: available
Module ID: `support-ticket`
Mount: `/support`

## Summary
Tenant-scoped support tickets with per-tenant sequence numbers, lifecycle state,
priority, assignment, comments, attachment metadata, and public follow-up share
tokens.

## Dependencies
- none

Optional integrations:

- auth
- audit-log
- email
- customer
- file-media
- support-inbox
- knowledge-base-rag

## Permissions
- support.read
- support.manage

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)

Tables:

- support_tickets
- support_ticket_sequences
- support_ticket_comments
- support_ticket_attachments
- support_ticket_share_tokens
- domain_events

## Hooks
- beforeTicketCreate
- afterTicketUpdated

## Events
Emits:

- support-ticket.created
- support-ticket.updated
- support-ticket.status_changed
- support-ticket.comment.created
- support-ticket.attachment.attached
- support-ticket.share-token.created
- support-ticket.share-token.revoked

Consumes:

- none

## Approval Gate
Risk: medium

Require explicit approval before:

- migrations
- PII fields
- attachment storage integration
- public share token behavior
- production deploy behavior
- external side effects

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.

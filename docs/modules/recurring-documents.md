# Recurring Documents

Status: draft
Module ID: `recurring-documents`
Mount: `/recurring-documents`

## Summary
Tenant-scoped recurring invoice and bill templates with integer-cent line totals, due-run selection, active/paused/completed/cancelled lifecycle state, max occurrence and end-date controls, and generated draft document payloads.

Accounting templates may expose this module as `/app/recurring-documents` or as a recurring invoice sub-route. Those routes are template adapters; the reusable module owns recurrence state, storage, events, permissions, hooks, and migrations.

## Dependencies
- optional: auth, audit-log

## Permissions
- recurring-documents.read
- recurring-documents.write
- recurring-documents.admin
- recurring-documents.extend
- recurring-documents.observe

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1

## Hooks
- beforeRecurringDocumentsCreate
- afterRecurringDocumentsUpdated

## Events
- recurring-documents.created
- recurring-documents.updated
- recurring-documents.paused
- recurring-documents.resumed
- recurring-documents.cancelled
- recurring-documents.completed
- recurring-documents.generated

## Invariants
- Money is stored as integer cents.
- Due-cycle generation must be idempotent for a tenant, template, and run instant.
- The module returns invoice or bill draft payloads; invoice/AP modules or app adapters own final document persistence, approval, posting, sending, and voiding.
- Completion, cancellation, pause, and resume transitions must preserve recurrence audit history.

## Approval Gate
Risk: medium

Generating customer/vendor-facing drafts, changing schedule semantics, adding migrations, and production deploys require explicit approval.

## Update Notes
Keep final invoice/bill creation and sending outside this module. Use hooks and adapter ports before forking recurrence internals.

# Invoice

Status: available
Module ID: `invoice`
Mount: `/invoices`

## Summary
Invoice records with gapless atomic numbering, per-line tax, recurring invoice templates, enforced draft -> open -> paid -> void lifecycle, idempotent payment application, payment-link metadata, and dunning hooks.

## Dependencies
- customer

Optional integrations:

- payment
- email
- audit-log
- jobs-workflows

## Permissions
- invoice.read
- invoice.write
- invoice.admin
- invoice.extend
- invoice.observe

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)

Tables:

- invoices
- invoice_line_items
- invoice_sequences
- invoice_payments
- invoice_recurring_templates
- invoice_recurring_template_line_items

## Hooks
- beforeInvoiceIssue
- onInvoiceIssued
- onInvoicePaid

## Events
Emits:

- invoice.created
- invoice.issued
- invoice.paid
- invoice.voided
- invoice.overdue
- invoice.payment_link_created
- invoice.recurring_template_created
- invoice.recurring_template_status_updated
- invoice.recurring_invoice_generated

Consumes:

- none

## Approval Gate
Risk: high

Require explicit approval before:

- migrations
- money mutations
- production deploy behavior

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.

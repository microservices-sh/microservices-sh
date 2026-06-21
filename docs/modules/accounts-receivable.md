# Accounts Receivable

Status: draft
Module ID: `accounts-receivable`
Mount: `/receivables`

## Summary
Tenant-scoped customer payment application, open receivables, aging buckets, and customer statement workflows that extend invoice and payment systems through ports.

## Dependencies
- invoice
- payment
- optional: accounting-core, customer, audit-log

## Permissions
- accounts-receivable.read
- accounts-receivable.write
- accounts-receivable.admin
- accounts-receivable.extend
- accounts-receivable.observe

## Resources
- D1

## Hooks
- beforeCustomerPaymentRecord
- beforePaymentApplication
- beforeStatementGenerate
- afterReceivableChanged

## Events
- accounts-receivable.customer_payment_recorded
- accounts-receivable.payment_applied
- accounts-receivable.aging_generated
- accounts-receivable.statement_generated

## Invariants
- Money is stored as integer cents.
- Payment idempotency keys are unique per tenant.
- Payment applications cannot exceed either payment amount or invoice open balance.
- Aging buckets use due dates and report dates, not wall-clock side effects hidden in storage.
- Invoice, payment, and accounting integration happens through ports or events.

## Approval Gate
Risk: medium

Payment application, statement generation with external delivery, accounting posting, migrations, and production deploys require explicit approval.

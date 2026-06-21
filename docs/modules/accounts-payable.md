# Accounts Payable

Status: draft
Module ID: `accounts-payable`
Mount: `/payables`

## Summary
Tenant-scoped vendor, bill, bill-line, payment application, and payable aging workflows with integer-cent balances and accounting handoff events.

## Dependencies
- accounting-core
- optional: payment, audit-log, file-media

## Permissions
- accounts-payable.read
- accounts-payable.write
- accounts-payable.admin
- accounts-payable.extend
- accounts-payable.observe

## Resources
- D1

## Hooks
- beforeVendorCreate
- beforeBillCreate
- beforeBillApprove
- beforeBillPaymentRecord
- afterPayableChanged

## Events
- accounts-payable.vendor_created
- accounts-payable.bill_created
- accounts-payable.bill_approved
- accounts-payable.bill_payment_recorded
- accounts-payable.aging_generated

## Invariants
- Money is stored as integer cents.
- Vendor bill numbers are unique per tenant and vendor when present.
- Bill line totals must equal bill totals before approval.
- Payment applications cannot exceed the open bill balance.
- Payment idempotency keys are unique per tenant.
- Accounting posting happens through ports or events, not direct template code.

## Approval Gate
Risk: medium

Bill approval, payment application, accounting posting, migrations, and production deploys require explicit approval.

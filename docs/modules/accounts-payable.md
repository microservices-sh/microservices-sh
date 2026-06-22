# Accounts Payable

Status: draft
Module ID: `accounts-payable`
Mount: `/payables`

## Summary
Tenant-scoped vendor, bill, bill-line, payment application, recurring bill, 1099 readiness, and payable aging workflows with integer-cent balances and accounting handoff events.

## Dependencies
- accounting-core
- optional: payment, audit-log, file-media

## Permissions
- accounts-payable.read
- accounts-payable.write
- accounts-payable.admin
- accounts-payable.pay
- accounts-payable.extend
- accounts-payable.observe

## Resources
- D1

## Hooks
- beforeVendorCreate
- beforeBillCreate
- beforeBillMarkPayable
- beforeBillVoid
- afterBillPayable
- afterBillVoided
- afterBillPaymentRecorded
- afterVendorCreated

## Events
- accounts-payable.vendor_created
- accounts-payable.vendor_updated
- accounts-payable.vendor_status_updated
- accounts-payable.bill_created
- accounts-payable.bill_marked_payable
- accounts-payable.bill_posted
- accounts-payable.bill_voided
- accounts-payable.bill_payment_recorded
- accounts-payable.bill_paid
- accounts-payable.recurring_bill_template_created
- accounts-payable.recurring_bill_template_status_updated
- accounts-payable.recurring_bill_generated

## Invariants
- Money is stored as integer cents.
- Vendor bill numbers are unique per tenant and vendor when present.
- Bill line totals must equal bill totals before approval.
- Bill approval and accounting posting are separate; `postBillToAccounting` only posts approved unpaid bills.
- `voidBill` only voids unpaid bills that have not been posted to accounting.
- Accounting-backed payments require target bills to already be posted.
- Payment applications cannot exceed the open bill balance.
- Payment idempotency keys are unique per tenant.
- Accounting posting happens through ports or events, not direct template code.

## Approval Gate
Risk: medium

Bill approval, bill voids, payment application, accounting posting, migrations, and production deploys require explicit approval.

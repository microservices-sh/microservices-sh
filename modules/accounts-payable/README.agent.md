# Accounts Payable Agent Notes

Use approval for money mutations: creating bills, marking bills payable, and recording bill payments. Vendor master mutations through `updateVendor` and `updateVendorStatus` also require operator approval. Always include `tenantId` and use idempotency keys for externally delivered payments.

Use `getVendor` for tenant-scoped vendor profile and 1099 metadata before building vendor-specific reports. Use `get1099VendorReport` for calendar-year 1099 readiness totals; it reports active 1099 vendors, payment totals, and missing-tax-ID warnings, but it does not file forms or validate TINs. Use `listBillPayments` for read-only AP payment history by tenant, vendor, bill, or status. Use `getBillPayment` when an operator needs the full payment record with applications before investigating journal references or a future void/reversal workflow.

Recurring bill templates can be listed with `listRecurringBillTemplates` by tenant, vendor, status, and due date. Use `updateRecurringBillTemplateStatus` to pause, resume, cancel, or complete a template; cancelled/completed templates are terminal. Run `generateDueRecurringBills` from a jobs-workflows schedule to create due bills and advance templates. Generation is replay-aware by tenant, recurring template, and bill date.

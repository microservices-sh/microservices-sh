# Accounts Payable Agent Notes

Use approval for money mutations: creating bills, marking bills payable, and recording bill payments. Always include `tenantId` and use idempotency keys for externally delivered payments.

Recurring bill templates can be listed with `listRecurringBillTemplates` by tenant, vendor, status, and due date. Use `updateRecurringBillTemplateStatus` to pause, resume, cancel, or complete a template; cancelled/completed templates are terminal. Run `generateDueRecurringBills` from a jobs-workflows schedule to create due bills and advance templates. Generation is replay-aware by tenant, recurring template, and bill date.

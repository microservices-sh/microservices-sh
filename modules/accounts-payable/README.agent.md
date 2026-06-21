# Accounts Payable Agent Notes

Use approval for money mutations: creating bills, marking bills payable, and recording bill payments. Always include `tenantId` and use idempotency keys for externally delivered payments.

Recurring bill templates can be listed with `listRecurringBillTemplates` by tenant, vendor, status, and due date. Use `updateRecurringBillTemplateStatus` to pause, resume, cancel, or complete a template; cancelled/completed templates are terminal. Treat generated bills as a separate idempotent workflow.

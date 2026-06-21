# Accounts Payable Agent Notes

Use approval for money mutations: creating bills, marking bills payable, and recording bill payments. Always include `tenantId` and use idempotency keys for externally delivered payments.

Recurring bill templates can be listed with `listRecurringBillTemplates` by tenant, vendor, status, and due date. Treat generated bills as a separate idempotent workflow; listing templates is read-only.

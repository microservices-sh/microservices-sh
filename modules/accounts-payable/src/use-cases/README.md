# Accounts Payable Use Cases

Add framework-neutral use cases here. Do not import SvelteKit, Hono, provider clients, or secret values directly in use cases.

- `createRecurringBillTemplate` creates a tenant-scoped recurring AP template and line items.
- `listRecurringBillTemplates` reads recurring AP templates for UI and scheduled generation filters.
- `updateRecurringBillTemplateStatus` handles pause/resume/cancel/complete transitions without direct store writes.
- `generateDueRecurringBills` creates bills for active due templates, advances their next occurrence, and recovers existing occurrences by `(tenantId, recurringTemplateId, billDate)` on retry.
- `voidBill` voids unpaid bills and requires accounting reversal for posted bills.
- `voidBillPayment` voids posted bill payments, restores applied bill balances, and requires accounting reversal for journaled payments.

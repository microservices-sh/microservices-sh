# Accounts Payable Use Cases

Add framework-neutral use cases here. Do not import SvelteKit, Hono, provider clients, or secret values directly in use cases.

- `createRecurringBillTemplate` creates a tenant-scoped recurring AP template and line items.
- `listRecurringBillTemplates` reads recurring AP templates for UI and scheduled generation filters.
- `updateRecurringBillTemplateStatus` handles pause/resume/cancel/complete transitions without direct store writes.
- `generateDueRecurringBills` creates bills for active due templates and advances their next occurrence.

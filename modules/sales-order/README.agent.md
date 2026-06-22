# Sales Order Module Agent Guide

Use this module through `@microservices-sh/sales-order`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

Do not add provider calls, secrets, migrations, or production deploy behavior without approval.

Behavior notes:

- Use `createDraftOrder` before any transition.
- `confirmOrder` is the only place that may call the optional inventory reservation port.
- `sendSalesOrder` may call an app-supplied delivery port. Require approval before customer-visible sends and keep provider credentials outside the module.
- `markOrderInvoiced` is the only place that may call the invoice draft port.
- Keep totals in integer cents and keep `(externalSource, externalId)` pairs together.

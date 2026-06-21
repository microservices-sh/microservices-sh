# StackSuite Accounting and Commerce Port

Date: 2026-06-21

## Goal

Adopt proven business-system behavior from these donor apps:

- `/home/ubuntu/Project/stacksuite/containers/accounting-system` at `57a8ab1`
- `/home/ubuntu/Project/stacksuite/containers/invoice-system-bao` at `55cd9b5`

Port them into microservices.sh as source-visible modules and generated templates,
not as copied full applications. The generated-app CLI should be able to discover,
check, plan, and eventually install/upgrade these modules through the existing
module and template contract model.

## Direction

Use `templates/erp-shell-sveltekit` as the host shell. It already owns layout,
routes, navigation, admin surfaces, and composition glue while modules own domain
behavior, schemas, migrations, ports, events, permissions, and tests.

Do not duplicate these existing modules:

- `auth`
- `identity`
- `org-team-rbac`
- `customer`
- `invoice`
- `payment`
- `email`
- `file-media`
- `webhook-delivery`
- `audit-log`
- `admin-shell`
- `jobs-workflows`
- `idempotency`

## Proposed Modules

### Commerce Modules

| Module | Owns | Donor Source |
| --- | --- | --- |
| `product-catalog` | Categories, products, SKU/external mapping, combo products | `invoice-system-bao/src/lib/db/schema.ts`, `queries/products.ts`, `queries/categories.ts` |
| `sales-order` | Sales order lifecycle, order line items, order-to-invoice conversion | `invoice-system-bao/src/lib/db/schema.ts`, `queries/salesOrders.ts` |
| `inventory` | Stock movements, reservation, release, stock deduction, stock reconciliation | `invoice-system-bao/src/lib/db/schema.ts`, `queries/inventory.ts` |
| `shipment` | Shipment batches, invoice shipment status, packing/fulfillment workflow | `invoice-system-bao/src/lib/db/schema.ts`, `queries/shipments.ts` |
| `commerce-sync` | WooCommerce/Shopify connection records, sync logs, webhooks, external IDs | `invoice-system-bao/src/lib/integrations/*`, `routes/api/webhooks/woocommerce/*` |

### Accounting Modules

| Module | Owns | Donor Source |
| --- | --- | --- |
| `accounting-core` | Chart of accounts, fiscal periods, journals, trial balance, general ledger | `accounting-system/src/lib/db/schema.ts`, `queries/accounts.ts`, `queries/fiscal-periods.ts`, `queries/journal-entries.ts` |
| `accounts-payable` | Vendors, bills, bill items, bill payments, recurring bills | `accounting-system/src/lib/db/schema.ts`, `queries/vendors.ts`, `queries/bills.ts`, `queries/bill-payments.ts` |
| `accounts-receivable` | Customer payments, payment applications, aged receivables, statements | `accounting-system/src/lib/db/schema.ts`, `queries/customer-payments.ts`, `queries/invoices.ts` AR report sections |
| `bank-reconciliation` | Bank accounts, statement imports, transactions, matches, reconciliations | `accounting-system/src/lib/db/schema.ts`, `queries/bank-accounts.ts`, `queries/bank-imports.ts`, `queries/bank-reconciliations.ts` |

## Template Targets

### `commerce-ops-sveltekit`

Start from `erp-shell-sveltekit` and add:

- `product-catalog`
- `sales-order`
- `inventory`
- `shipment`
- `commerce-sync`
- existing `customer`, `invoice`, `payment`, `email`, `file-media`, `audit-log`, `jobs-workflows`

Primary proof: WooCommerce/order intake to sales order, stock reservation, invoice,
payment/shipment status, and operator dashboard.

### `accounting-erp-sveltekit`

Start from `erp-shell-sveltekit` and add:

- `accounting-core`
- `accounts-payable`
- `accounts-receivable`
- `bank-reconciliation`
- existing `customer`, `invoice`, `payment`, `file-media`, `audit-log`, `webhook-delivery`, `jobs-workflows`

Primary proof: invoice/bill posting to journals, payment application, AP/AR aging,
bank import, reconciliation, and audit trail.

## Cross-Cutting Port Rules

1. Use integer cents in module APIs and tests. Donor apps use `REAL` money fields
   in several places; keep generated UI formatting separate from domain values.
2. Keep import-time module source side-effect free.
3. Use storage-level uniqueness or explicit idempotency keys for external sync,
   webhooks, posting, payment application, stock reservation, and stock deduction.
4. Store provider credentials as declared module secrets or encrypted provider
   config. Do not copy secret fields from donor `settings` tables into D1.
5. Every mutation must have permissions and audit hooks.
6. Every module must support tenant/org scoping even if the first template is a
   single-company ERP shell.
7. Keep SvelteKit routes thin: parse input, authorize, call module use cases, map
   results to responses.

## Source Safety Boundaries

Do not copy or commit:

- `.env`, `.dev.vars`, `wrangler.toml`, request logs, R2 outputs, or generated
  `.svelte-kit` files.
- Customer/order PII from `invoice-system-bao/invoices.txt`, seed payloads,
  webhook logs, addresses, phones, emails, tax IDs, or bank data.
- Stripe, WooCommerce, MCP token, cron secret, API key, or Cloudflare resource
  values.
- Source money persistence patterns that use floating point amounts; target
  modules keep integer cents and basis points.

When adapting source code, preserve tenant scoping and idempotency, keep module
internals behind ports/use-cases, and treat donor SvelteKit routes as workflow
references only.

## CLI/Create-App Adoption Points

- Add new module packages under `modules/*`.
- Add module docs under `docs/modules/*` and update docs/catalog references.
- Add packages to `pnpm-workspace.yaml` automatically through `modules/*`.
- Add generated templates under `templates/*`.
- Update `packages/create-microservices-app/src/bundled-deps.js`:
  - `BUNDLED_MODULES`
  - `REPO_TEMPLATES`
  - `REPO_TEMPLATE_MODULES`
  - `REPO_TEMPLATE_PACKAGES` if new shared packages are introduced.
- Update create-app template list in `packages/create-microservices-app/src/index.js`.
- Update ERP shell navigation and enabled-module route guards for user-facing modules.
- Run the bundle closure test so scaffolded apps do not retain `workspace:*`
  dependencies or missing `file:` paths.

## First Implementation Slice

Start with `product-catalog`.

Rationale:

- It is a low-risk dependency for sales orders, inventory, shipments, and commerce
  sync.
- It has clear donor boundaries: categories, products, product categories, combo
  products.
- It can be tested without payment, accounting, external provider calls, or UI.
- It exercises the full module lifecycle: manifest, migration, schemas, use cases,
  D1/memory adapters, reference UI, docs, lock/catalog, and create-app bundling.

Acceptance criteria:

- `@microservices-sh/product-catalog` builds and passes module spec checks.
- Module exposes create/update/list/get/deactivate product and category use cases.
- Combo products have deterministic component expansion.
- SKU and external ID uniqueness are enforced at adapter boundaries.
- `pnpm registry:build -- --json` includes the module.
- `packages/create-microservices-app/tests/template-bundle-closure.test.js`
  remains green after adding it to a template dependency set.

## Implementation Status

- Completed first commerce/accounting slice: `product-catalog`, `inventory`,
  `sales-order`, `shipment`, and `accounting-core`.
- Completed second accounting/sync slice: `accounts-payable`,
  `accounts-receivable`, `bank-reconciliation`, and `commerce-sync`.
- `erp-shell-sveltekit` now declares the StackSuite commerce/accounting modules
  as optional slots, carries template migrations through `0027_commerce_sync.sql`,
  and is bundled by `create-microservices-app`.
- Added CLI-discoverable repo templates `commerce-ops-sveltekit` and
  `accounting-erp-sveltekit`, derived from the ERP shell with focused manifests,
  lockfiles, enabled-module sets, docs, and create-app bundle registration.
- Completed route/UI split: `commerce-ops-sveltekit` now has product catalog,
  inventory, sales order, shipment, and commerce-sync pages; `accounting-erp-sveltekit`
  now has ledger, payables, receivables, and banking pages.
- Code Memory now supports StackSuite-focused scan candidates for journal
  posting, bank reconciliation, recurring invoice/bill generation, WooCommerce
  sync, shipment/inventory reservation, printable documents, invoice numbering,
  Stripe webhooks, D1 pagination, and auth/session helpers.
- Completed parity hardening: commerce document exports, packing-slip and
  pick-list print helpers, invoice-send/payment-link workflows, scheduled
  runtime glue, WooCommerce page syncs and signed order webhooks, lifecycle-aware
  inventory reservations, combo-component stock reservations, MCP lifecycle side
  effects, and invoice-originated shipment deductions.
- Completed accounting parity hardening: scheduled runtime glue, ledger journal
  creation/post/void and trial-balance UI, AP posting through the template-side
  accounting poster, manual invoice issue/payment/void AR snapshot sync, invoice
  payment links and email send, signed Stripe settlement webhooks, AR aging, AP
  aging, customer statements, AR customer-payment settlement posted to
  `accounting-core`, and recurring invoice jobs posting/syncing generated
  auto-issued invoices.
- Remaining follow-up is narrower: prune inherited broad ERP shell dependencies
  and migrations only after shared dashboard/settings/support routes are
  intentionally narrowed, and add Code Memory/CLI hardening docs if donor-scan
  reuse needs to become a generated-app feature.

## Reusable Candidate Map

| Candidate | Source Paths | Target | Mode |
| --- | --- | --- | --- |
| Chart of accounts setup | `accounting-system/src/lib/db/seeds/chart-of-accounts.ts` | `accounting-core`, `accounting-erp-sveltekit` | adapt |
| Journal posting/trial balance | `accounting-system/src/lib/db/queries/journal-entries.ts` | `accounting-core` | test-only/adapt |
| AP/AR accounting bridge | `accounting-system/src/lib/db/queries/invoices.ts`, `bills.ts`, `customer-payments.ts`, `bill-payments.ts` | `invoice`, `accounts-receivable`, `accounts-payable`, `accounting-core` | adapt |
| Money/CSV helpers | `accounting-system/src/lib/money.ts`, `csv.ts`, and tests | shared helpers or Code Memory capsules | copy/adapt |
| Bank import/reconciliation | `accounting-system/src/lib/db/queries/bank-imports.ts`, `bank-reconciliations.ts`, `bank-transactions.ts` | `bank-reconciliation` | adapt/test-only |
| WooCommerce sync/webhooks | `invoice-system-bao/src/lib/integrations/woocommerce*.ts`, `sync.ts` | `commerce-sync`, `commerce-ops-sveltekit` | adapt |
| WooCommerce order contact snapshots | `invoice-system-bao/src/lib/integrations/woocommerce-order-contact.ts`, `src/lib/utils/order-contact.ts` | `sales-order`, `invoice`, `commerce-sync` | copy/adapt |
| Inventory reservations/shipments | `invoice-system-bao/src/lib/db/queries/inventory.ts`, `shipments.ts` | `inventory`, `shipment`, `commerce-ops-sveltekit` | adapt/test-only |
| Recurring invoices/bills | `accounting-system/src/lib/db/queries/recurring-invoices.ts`, `recurring-bills.ts` | `invoice`, `accounts-payable`, `jobs-workflows` | test-only/adapt |
| Scheduled sync | `*/src/lib/server/scheduled.ts`, `invoice-system-bao/src/routes/api/cron/sync/+server.ts` | `jobs-workflows`, template cron glue | adapt |
| API keys/OpenAPI | `accounting-system/src/lib/server/api-auth.ts`, `src/lib/api/openapi.ts`, `src/routes/api/v1` | `gateway`, accounting template API surface | adapt |
| MCP admin tooling | `invoice-system-bao/src/lib/mcp/server.ts`, `tools/mcp/src` | `gateway`, SDK/tool manifests, generated MCP packages | adapt |

## Next Implementation Slices

1. Completed: contract alignment for `accounting-core`, AP, AR, bank
   reconciliation, and focused template checks now covers ledger, payables,
   receivables, banking, reports, invoice collection, webhook settlement, and
   recurring invoice job settlement.
2. Completed: AP-to-ledger and AR-to-ledger posting now happen through
   template-side accounting adapters instead of direct route-owned journal
   creation.
3. Completed: AR snapshots synchronize from manual invoice issue, payment, void,
   manual receivables payment, signed Stripe settlement, and recurring
   auto-issued invoice jobs while `invoice` remains authoritative for invoice
   lifecycle state.
4. Completed: bank matching parity now exposes `suggestMatches`, `createMatch`,
   import history, reconciliation start, and reconciliation completion in the
   accounting template workflow.
5. Completed: accounting-core UI now includes fiscal-period creation/status,
   journal draft creation, post, void/reversal, and trial balance.
6. Completed: commerce sync and shipment parity now covers WooCommerce HMAC
   verification, contact snapshots, inventory reservation/release, shipment
   completion stock deduction, shipment batches, packing slips, and pick lists.
7. Remaining candidate: prune focused template dependency/migration sets where
   inherited ERP shell routes are no longer intentionally exposed.
8. Remaining candidate: add explicit Code Memory/CLI scan docs for the two donor
   projects if future generated apps should guide agents toward these reuse
   sources automatically.
9. Ongoing verification: keep create-app bundled templates, shim checks,
   registry/spec checks, focused template builds, and integration tests green
   whenever either focused StackSuite template changes.

## Open Questions

1. Should `accounts-receivable` extend the existing `invoice` module or stay
   separate as payment application/reporting?
2. Should `commerce-sync` be one provider-capable module, or split into
   `commerce-sync` core plus `woocommerce-sync` provider?
3. Should `sales-order` convert to the current `invoice` module's cents-based
   invoice records, or should invoice be extended first for shipping/contact
   snapshots?
4. Which inherited ERP shell modules can be safely pruned from the focused
   templates without breaking shared dashboards, demo seeding, or route imports?

# StackSuite Accounting and Commerce Port

Date: 2026-06-21

## Goal

Adopt proven business-system behavior from these donor apps:

- `/home/ubuntu/Project/stacksuite/containers/accounting-system`
- `/home/ubuntu/Project/stacksuite/containers/invoice-system-bao`

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
- Follow-up template split remains open: fork `commerce-ops-sveltekit` and
  `accounting-erp-sveltekit` from the ERP shell once route-level UI proves stable.

## Open Questions

1. Should `accounts-receivable` extend the existing `invoice` module or stay
   separate as payment application/reporting?
2. Should `commerce-sync` be one provider-capable module, or split into
   `commerce-sync` core plus `woocommerce-sync` provider?
3. Should `sales-order` convert to the current `invoice` module's cents-based
   invoice records, or should invoice be extended first for shipping/contact
   snapshots?
4. Which template should be public first: `commerce-ops-sveltekit` or
   `accounting-erp-sveltekit`?

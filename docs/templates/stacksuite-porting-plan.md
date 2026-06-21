# StackSuite Accounting And Invoice Porting Plan

Status: draft
Source review date: 2026-06-21

## Scope

This plan covers adopting the StackSuite source projects into `create-microservices-app` as reusable modules and focused templates:

- `/home/ubuntu/Project/stacksuite/containers/accounting-system`
- `/home/ubuntu/Project/stacksuite/containers/invoice-system-bao`
- target repo modules under `modules/*`
- target templates under `templates/accounting-erp-sveltekit` and `templates/commerce-ops-sveltekit`

The goal is not to copy the source apps wholesale. The CLI should expose reusable domain modules, compose those modules into focused templates, and keep generated projects upgradeable.

## Current Target Shape

The current repo already has the right foundation:

- `accounting-erp-sveltekit` for ledger, payables, receivables, banking, invoices, payments, support, files, notifications, jobs, webhooks, team, and settings.
- `commerce-ops-sveltekit` for customers, products, inventory, invoices, payments, sales orders, shipments, commerce sync, support, files, notifications, jobs, webhooks, team, and settings.
- reusable modules for `invoice`, `payment`, `product-catalog`, `inventory`, `sales-order`, `shipment`, `commerce-sync`, `accounting-core`, `accounts-payable`, `accounts-receivable`, and `bank-reconciliation`.
- CLI bundle closure tests and template spec checks that can prove generated apps include required local packages, migrations, bindings, and module metadata.

Recent focused-template cleanup should be treated as the baseline: do not reintroduce broad ERP-shell modules into the focused accounting or commerce templates unless a route, migration, and module contract actually require them.

## Source Feature Inventory

`accounting-system` contains accounting depth that should mostly become reusable module surface:

- company, invoice, email, Stripe, onboarding, and accounting settings.
- integrations, API keys, API request logs, webhook endpoints, webhook deliveries, StackSuite connections, and sync logs.
- chart of accounts, fiscal periods, journal entries, and journal lines.
- roles, user roles, user preferences, invitations, users, sessions, and auth accounts.
- clients, products, categories, combo products, invoices, invoice items, estimates, estimate items, recurring invoices, and recurring invoice items.
- vendors, bills, bill items, bill payments, bill payment applications, recurring bills, and recurring bill items.
- customer payments and payment applications.
- bank accounts, bank imports, bank transactions, bank reconciliations, and reconciliation matches.
- analytics routes for daily, monthly, client, and product views.
- OCR upload and review routes for receipts and bank statements.

`invoice-system-bao` contains commerce and operational depth that should become commerce modules and template routes:

- richer numbering settings for invoices, sales orders, shipments, and reconciliations.
- configurable PDF filename pattern and admin payment methods.
- MCP tokens, MCP routes, and an external MCP tool server.
- integrations with webhook secrets, sync logs, WooCommerce webhooks, order-contact snapshots, and scheduled sync.
- products with aliases, external IDs, category assignments, combo products, stock tracking, reorder points, and reorder quantities.
- sales orders, sales order items, bulk status changes, send actions, and print utilities.
- shipment batches, shipment invoice links, shipment status changes, and packing-slip utilities.
- stock movements, stock reconciliations, stock reconciliation items, receive/adjust/reconcile routes, and inventory alerts.
- analytics routes for daily, monthly, clients, products, and items.

## Boundary Rules

Use these boundaries when porting:

- Put durable business behavior, tenant-scoped persistence, event names, permissions, and provider-neutral use cases in modules.
- Put SvelteKit routes, layout, page copy, table formatting, demo seed data, and module wiring in templates.
- Put provider-specific credentials, webhook verification, and external API calls behind module ports or template adapters.
- Do not copy source auth/session tables directly. Generated templates should keep the repo's identity and org/team/RBAC modules.
- Do not copy source global tables directly. Module migrations must be tenant-scoped and must avoid generic table names when a module-specific name is clearer.
- Do not write demo seed data during D1 page loads. Demo writes are acceptable only for in-memory fallback stores or explicit seed/setup actions.

## Module Backlog

### Invoice

Port source features into `modules/invoice` before expanding template UI:

- estimates: estimate header, line items, status lifecycle, convert-to-invoice hook.
- recurring invoices: template create/list/update, next-run calculation, scheduled generation job payloads.
- send/payment-link state: provider-neutral send attempts, last sent timestamp, payment URL metadata, and delivery events.
- print/export metadata: PDF filename pattern, public print view data contract, QR/payment-link fields.
- bulk status actions where they are idempotent and permission-gated.

### Accounts Payable

The module already has recurring bill creation storage, but the UI needs more API surface first:

- list recurring bill templates by tenant, vendor, and status.
- update/pause/resume recurring bill templates.
- generate due bills through a jobs-workflows schedule.
- expose payment approval thresholds and approval routing as config or hooks.

### Accounting Core

Port setup and reporting depth into `modules/accounting-core`:

- chart-of-accounts seed packs for GAAP/IFRS and industry presets.
- setup wizard use cases for fiscal year, base currency, default AR/AP/income/retained earnings accounts.
- fiscal-period close/reopen rules.
- trial balance, income statement, balance sheet, cash flow, and general ledger report contracts.

### Bank Reconciliation

Move source banking depth into `modules/bank-reconciliation`:

- bank import sessions with parsed file metadata.
- transaction classification state.
- reconciliation sessions and match proposals.
- reviewed/accepted match lifecycle.
- hooks for OCR/document-extraction output.

### Commerce Sync

Extend `modules/commerce-sync` from generic mapping/run storage to production integration workflows:

- WooCommerce connection config validation and encrypted credential envelope contract.
- webhook signature verification port and idempotency keys.
- order-contact snapshots.
- sync log rollups for created, updated, skipped, and failed records.
- scheduled sync payloads for jobs-workflows.
- mapping adapters for customer, product, order, invoice, sales-order, and shipment entities.

### Product Catalog And Inventory

Use the source commerce schema to extend the existing modules:

- product aliases for packing slips and operational labels.
- reorder point and reorder quantity.
- stock movement ledger with reason/source metadata.
- receive, adjust, and reconcile use cases.
- inventory alert read models.

### Sales Order And Shipment

The modules exist, but source UI expects more workflow endpoints:

- sales-order detail, send action, and bulk status transitions.
- order-to-invoice and order-to-shipment handoff ports.
- shipment batch detail, shipment item links, status transitions, and completion constraints.
- packing slip print/export data contract.

### Gateway And External API

Source API-key tables should map to the existing gateway direction:

- scoped API keys with hash storage, prefix display, expiry, and revocation.
- request logs with path, status, duration, actor, API key, and truncated request/response metadata.
- module permission scopes for invoices, bills, customers, products, orders, shipments, and payments.

### MCP / Agent Operations

Do not bury MCP logic inside a single invoice template. Add a reusable agent-facing surface:

- token issuance and rotation with scoped permissions.
- server-sent-event or streamable route adapter owned by templates.
- tool registration for invoices, customers, products, inventory, sales orders, shipments, and settings.
- audit events for all external tool calls.

This may become a new module, or it may extend `agent-dispatch` if the product direction is to treat MCP tools as dispatchable agent capabilities.

### OCR And Document Extraction

Source OCR receipt and bank statement flows should be handled through `document-extraction` plus accounting/banking hooks:

- receipt extraction to draft bill line items.
- bank-statement extraction to bank import sessions and candidate transactions.
- review UI remains template-owned.
- all provider calls stay approval-gated.

## Template Plan

### `accounting-erp-sveltekit`

Port in this order:

1. Accounting setup route: chart seed selection, fiscal year, base currency, default accounts.
2. Chart of accounts and fiscal periods settings routes.
3. Ledger/report routes backed by accounting-core report contracts.
4. Payables recurring templates and scheduled bill generation once AP list/update/generate APIs exist.
5. Receivables recurring invoices and estimates once invoice APIs exist.
6. Banking import/reconciliation detail routes once bank-reconciliation exposes sessions and matches.
7. OCR review routes wired to document-extraction hooks.
8. API keys and request logs after gateway scope support exists.

### `commerce-ops-sveltekit`

Port in this order:

1. Sales-order detail/create/send/bulk status routes.
2. Shipment batch detail/status/packing-slip routes.
3. Inventory receive/adjust/reconcile routes and movement history.
4. WooCommerce connection settings, sync logs, and webhook setup.
5. Invoice print/export and payment-link surfaces.
6. MCP settings page and tool endpoint adapter after the reusable MCP/agent surface exists.
7. Analytics pages for daily, monthly, client, product, and item views using module read models.

### Possible New Template: `invoice-ops-sveltekit`

Only add a separate invoice-focused template if user testing shows `commerce-ops-sveltekit` is too broad for invoice-only users. It would include:

- identity, org/team/RBAC, customer, invoice, payment, product-catalog, file-media, email, jobs, notifications, webhooks, support, gateway.
- optional commerce-sync and MCP.
- no inventory, sales-order, shipment, accounting-core, AP, AR, or bank-reconciliation by default.

## CLI Packaging Requirements

Every porting slice must update the CLI surface when it changes generated output:

- module package exports and `module.json`.
- module migrations and `microservices.check.mjs`.
- module docs: `README.md`, `README.agent.md`, `llms.txt`, OpenAPI, JSON schemas, permissions, resources, events, hooks, and config.
- template manifests: `microservices.template.json`, `microservices.lock.json`, required/optional modules, slots, migrations, bindings, docs, and README route map.
- `packages/create-microservices-app/src/bundled-deps.js` when a focused template requires a new local package in generated apps.
- bundle closure tests when template dependency rules change.
- registry checks if module/template status changes from draft to available.

## Migration Strategy

Translate source migrations into module-owned migrations; do not import Drizzle SQL verbatim unless names, scope, and ownership already match.

- Add `tenant_id` or `org_id` to all business tables that become modules.
- Include tenant in all external uniqueness constraints, for example `(tenant_id, external_source, external_id)`.
- Prefer module-specific table names for accounting/AP/AR/banking tables to avoid collisions in composed templates.
- Keep source operational counters as explicit sequence tables or module settings, not as global `settings` columns.
- Model provider secrets as encrypted external bindings or provider config references; do not persist raw source-style credentials in generic settings.
- Add idempotency keys to webhooks, scheduled generation, payment recording, order sync, shipment completion, and bulk status updates.

## Validation Gates

For each module slice:

```bash
pnpm --filter @microservices-sh/<module> build
pnpm --filter @microservices-sh/<module> test
pnpm --filter @microservices-sh/<module> check:spec
```

For each template slice:

```bash
pnpm --dir templates/<template> check:spec
pnpm --dir templates/<template> build
pnpm exec vitest run packages/create-microservices-app/tests/template-bundle-closure.test.js
pnpm spec:check:all
```

For CLI packaging changes:

```bash
pnpm --filter create-microservices-app build
pnpm --filter create-microservices-app test
pnpm --filter create-microservices-app smoke
```

Run generated-project smoke tests before marking a template available:

```bash
pnpm --filter create-microservices-app pack
pnpm create microservices-app@<packed-version> /tmp/<generated-app> --template <template>
pnpm --dir /tmp/<generated-app> install
pnpm --dir /tmp/<generated-app> microservices check --json
pnpm --dir /tmp/<generated-app> build
```

## Phased Execution

### Phase 0: Baseline Hardening

Done or in progress:

- keep accounting and commerce focused templates from inheriting unrelated broad ERP-shell modules.
- make module enablement, template manifests, locks, migrations, docs, and CLI bundled-deps agree.
- avoid D1 writes during accounting page loads.
- expose support-ticket as a real route where it is required by focused templates.

### Phase 1: Source Gap Closure

Add missing module API surface without large template UI changes:

- invoice estimates and recurring invoice contracts.
- AP recurring list/update/generate contracts.
- accounting setup/report contracts.
- commerce sync webhook/signature/sync-log/order-contact contracts.
- inventory stock movement and reconciliation contracts.

### Phase 2: Focused Template Routes

Add user-facing routes only after the backing module API exists:

- accounting setup, chart, fiscal periods, reports, recurring AP/AR, estimates, banking import/reconciliation detail.
- commerce sales-order detail/create/send, shipment detail/packing slip, inventory receive/adjust/reconcile, sync logs, MCP settings.

### Phase 3: External Operations

Wire approval-gated provider operations:

- Stripe payment links and OAuth/connect status.
- WooCommerce manual sync, scheduled sync, and webhooks.
- Resend/SMTP email send attempts.
- OCR/document extraction review loops.
- MCP tools with audited tokens.

### Phase 4: CLI Productization

Make the modules and templates first-class CLI products:

- mark stable modules/templates as `available` only after generated-project smoke passes.
- update `templates/README.md`, module catalog docs, registry build outputs, and LLM docs.
- add migration/upgrade notes for generated projects already using older focused templates.

## Key Risks

- Source apps use global table names and mixed settings tables; direct copying would break tenant composition.
- Recurring invoice/bill generation crosses modules and must be idempotent.
- Provider webhooks require replay protection, signature verification, and tenant mapping before write actions are enabled.
- MCP tools can mutate business state, so token scope, audit logging, and approval boundaries must be designed before exposing write tools.
- Template route ports can compile while still bypassing module invariants; every route should use module use cases or documented adapter ports.

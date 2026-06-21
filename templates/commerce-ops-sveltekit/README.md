# Commerce Ops SvelteKit Template

Status: `ready`

A StackSuite-derived commerce operations shell for Cloudflare SvelteKit. It
starts from the ERP shell runtime and focuses the generated app around products,
inventory, sales orders, fulfillment, commerce sync, invoices, payments, files,
and background jobs.

The template is source-visible and lock-driven. Domain behavior lives in module
packages; the template owns routes, layout, shell composition, local setup, and
the generated-project CLI.

## Modules

Focused modules:

- `product-catalog`
- `gateway`
- `inventory`
- `sales-order`
- `shipment`
- `commerce-sync`
- `customer`
- `support-ticket`
- `invoice`
- `payment`
- `file-media`
- `jobs-workflows`
- `audit-log`
- `org-team-rbac`
- `admin-shell`

The current SvelteKit UI is inherited from `erp-shell-sveltekit` and extended
with commerce pages for product catalog, inventory, sales orders, fulfillment,
and sync review.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Redirects to `/app` or `/login` |
| `/login` | Passwordless login through `identity` and `email` module wiring |
| `/signup` | One-time company setup |
| `/app` | Operations dashboard |
| `/app/customers` | Customer book |
| `/app/support` | Support queue |
| `/app/products` | Product catalog and stock policy setup |
| `/app/inventory` | Stock balances, recent movements, and manual receiving |
| `/app/sales-orders` | Draft sales order intake and order ledger |
| `/app/shipments` | Fulfillment batches, shipment line review, packing slip print, and pick-list print |
| `/app/commerce-sync` | Provider connection, sync-run, mapping, and webhook contract review |
| `/api/commerce-sync/woocommerce/[tenantId]/[connectionId]` | Raw WooCommerce webhook endpoint; verifies `WOOCOMMERCE_WEBHOOK_SECRET`, records receipts, and imports order webhooks as draft sales orders |
| `/app/invoices` | Invoice ledger |
| `/app/payments` | Payment review |
| `/app/files` | Stored files |
| `/app/jobs` | Queue health and recurring schedules |
| `/app/webhooks` | Endpoint inventory and delivery attempts |
| `/admin`, `/admin/[resource]` | Super-admin table gateway via `admin-shell` |

## Architecture

SvelteKit routes are thin adapters. Keep commerce behavior in module use cases
and ports, not in route files. The checked-in D1 migrations include the inherited
ERP shell tables plus StackSuite commerce/accounting tables so local D1 runs do
not break while the UI is being split.

Stores resolve to D1/R2 adapters in production and in-memory adapters locally.
The deployed Worker is the canonical backend: D1 stores business records, R2
stores bytes, KV backs shared gateway state, Queues carry async jobs, and
`audit-log` records business operations.

## Verification

```bash
pnpm build
pnpm check:spec
```

## Deploy

This app ships with a self-hosted Cloudflare deploy workflow in
`.github/workflows/deploy.yml`. Before a real deploy, replace resource
placeholders in `wrangler.jsonc`, create the matching D1/R2/KV/Queue resources,
set Cloudflare credentials as repository secrets, and configure
`WOOCOMMERCE_WEBHOOK_SECRET` as the shared WooCommerce webhook signing secret.

# Accounting ERP SvelteKit Template

Status: `ready`

A StackSuite-derived accounting ERP shell for Cloudflare SvelteKit. It starts
from the ERP shell runtime and focuses the generated app around chart of
accounts, fiscal periods, journals, payables, receivables, bank reconciliation,
invoices, payments, files, webhooks, and background jobs.

The template is source-visible and lock-driven. Domain behavior lives in module
packages; the template owns routes, layout, shell composition, local setup, and
the generated-project CLI.

## Modules

Focused modules:

- `accounting-core`
- `accounts-payable`
- `accounts-receivable`
- `bank-reconciliation`
- `invoice`
- `payment`
- `customer`
- `file-media`
- `webhook-delivery`
- `jobs-workflows`
- `audit-log`
- `org-team-rbac`
- `admin-shell`

The current SvelteKit UI is inherited from `erp-shell-sveltekit` and extended
with accounting pages for ledger review, payables, receivables aging, bank
import, and reconciliation.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Redirects to `/app` or `/login` |
| `/login` | Passwordless login through `identity` and `email` module wiring |
| `/signup` | One-time company setup |
| `/app` | Operations dashboard |
| `/app/customers` | Customer book |
| `/app/ledger` | Chart of accounts and account creation |
| `/app/payables` | Vendor, bill, and AP aging review |
| `/app/receivables` | Open receivables and AR aging buckets |
| `/app/banking` | Statement import and reconciliation review |
| `/app/invoices` | Invoice ledger |
| `/app/payments` | Payment review |
| `/app/files` | Stored files |
| `/app/jobs` | Queue health and recurring schedules |
| `/app/webhooks` | Endpoint inventory and delivery attempts |
| `/admin`, `/admin/[resource]` | Super-admin table gateway via `admin-shell` |

## Architecture

SvelteKit routes are thin adapters. Keep accounting behavior in module use cases
and ports, not in route files. The checked-in D1 migrations include the inherited
ERP shell tables plus StackSuite accounting tables so local D1 runs do not break
while the UI is being split.

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
and set Cloudflare credentials as repository secrets.

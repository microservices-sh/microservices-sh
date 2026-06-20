# ERP Shell SvelteKit Template

Status: `ready`

A single-company **ERP shell** for Cloudflare SvelteKit. One company organization,
employees with role-based access, and operational modules (customers, invoices,
files) that plug into a left-sidebar app shell. The sidebar is **derived from the
installed module set** in `microservices.lock.json` — not hardcoded. A super-admin
area gives schema-driven CRUD over the underlying tables.

## Modules

Wired: auth, identity, org-team-rbac, admin-shell, audit-log, customer, invoice,
file-media, jobs-workflows, notifications-inapp, webhook-delivery.

User-facing modules get a sidebar entry; pure infra modules (auth, identity,
audit-log, gateway) do not.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Redirects to `/app` (signed in) or `/login` |
| `/login` | Demo email session (swap in `@microservices-sh/identity`) |
| `/signup` | One-time company setup: creates the single org, you become owner |
| `/app` | Company dashboard (customers, invoices, outstanding, team) |
| `/app/customers` | Customer book (list + add), customer module |
| `/app/invoices` | Invoice ledger, invoice module |
| `/app/files` | Stored files (metadata), file-media module |
| `/app/jobs` | Queue health and recurring schedules, jobs-workflows module |
| `/app/webhooks` | Endpoint inventory and delivery attempts, webhook-delivery module |
| `/app/team` | Members, invitations, role changes (RBAC-gated) |
| `/app/team/accept` | Accept a single-use, expiring invitation |
| `/app/settings` | Company details, your permissions, recent audit activity |
| `/admin`, `/admin/[resource]` | Super-admin CRUD over tables via admin-shell |
| `/api/desktop/import` | Authenticated desktop approved-draft import endpoint |

`/app/*` is gated by company membership through `authorize` / `resolvePermissions`.

## Architecture

SvelteKit routes are thin adapters. Domain logic lives in the modules' detached
use cases (`createOrganization`, `upsertCustomer`, `createInvoice`, `listFiles`,
…). The template owns the app shell, the lock-driven sidebar, routes, layout, and
composition glue only.

Stores resolve to D1/R2 adapters in production and in-memory adapters locally, so
the app runs out of the box for development (seeded via `src/lib/server/demo.ts`).
The deployed Worker is the canonical multi-user ERP backend: D1 stores business
records and module tables, R2 stores file/image bytes, KV backs shared gateway
rate limits, and Queues carry async module jobs such as approved desktop imports.

Desktop approved-draft import follows this boundary:

```txt
Desktop Tauri app -> authenticated HTTPS import API on ERP Worker -> module use cases/jobs
  -> D1/R2/KV/Queues -> audit log
```

Set `DESKTOP_IMPORT_TOKEN` as a Worker secret before enabling desktop imports:

```bash
wrangler secret put DESKTOP_IMPORT_TOKEN
```

See `CLAUDE.md` for how the lock-driven sidebar works and where to wire modules.

## Verification

```bash
pnpm build
pnpm check:spec
```

## Deploy

This app ships with a self-hosted deploy pipeline you own and run:
`.github/workflows/deploy.yml`. On every push to `main` it verifies the app
(`pnpm run check:spec` + `pnpm run build`), applies remote D1 migrations
(`wrangler d1 migrations apply DB --remote`), then deploys to **your** Cloudflare
account (`wrangler deploy`). Deploy only runs if the verify step passes.

Set these two repo secrets (GitHub → Settings → Secrets and variables → Actions
→ New repository secret), or with the `gh` CLI:

| Secret | What it is |
|--------|------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with `Workers Scripts:Edit` and `D1:Edit` permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account id |

```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
```

Before the first deploy, replace `database_id` (`REPLACE_WITH_D1_ID`) and the
KV id placeholders in `wrangler.jsonc` with your provisioned Cloudflare resource
ids. Create or rename the R2 buckets and queue to match the bindings in
`wrangler.jsonc`.

## Theming

The design system is token-driven (Tailwind v4, CSS-first) in `src/app.css`. Change
`--color-accent` to rebrand. See `THEMING.md`.

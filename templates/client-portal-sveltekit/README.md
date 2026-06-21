# Client Portal SvelteKit Template

Status: ready local baseline
Template ID: `client-portal-sveltekit`

An auth-gated client portal for professional-services businesses. A logged-in
customer sees their own invoices, documents, and account; staff get an admin
side spanning all customers, invoices, and activity.

Billing comes from `@microservices-sh/invoice`, documents from
`@microservices-sh/file-media`, quota accounting from
`@microservices-sh/storage-entitlements`, accounts from
`@microservices-sh/customer`, sessions from `@microservices-sh/identity`,
login-code delivery from `@microservices-sh/email`, and the activity trail from
`@microservices-sh/audit-log`.
The template owns only SvelteKit routes, UI, composition glue, and Cloudflare
binding wiring.

## Styling

The UI uses **Tailwind CSS v4** (CSS-first, no config file). The whole design
system — colors, fonts, radius, shadows — lives in one `@theme` block in
`src/app.css`. Change `--color-accent` to rebrand the whole app. See
[`THEMING.md`](./THEMING.md).

## Design Rules

- Keep SvelteKit route files thin (`+page.server.ts`, `+server.ts` are adapters).
- Put billing, file, customer, and audit behavior in detached module use cases.
- Put Cloudflare/D1/R2 details behind module adapters.
- Keep all side-effectful provider modules plan/approval gated.
- Preserve `microservices.lock.json` as the upgrade source of truth.

## Routes

| Route | Audience | Purpose |
|-------|----------|---------|
| `/` | public | Landing page |
| `/login` | public | Passwordless email-code sign-in via identity + email modules |
| `/portal` | customer | Dashboard — own invoices + files summary |
| `/portal/invoices` | customer | Own invoices |
| `/portal/invoices/[id]` | customer | Invoice detail with line items |
| `/portal/files` | customer | Documents + quota-gated two-step upload |
| `/admin` | staff | Workspace overview + recent activity |
| `/admin/invoices` | staff | All invoices |
| `/admin/customers` | staff | All customers with billing rollups |

Customer sessions are scoped to their own `customerId`; file reads and uploads
pass that id as `ownerId` to `@microservices-sh/file-media`; uploads also call
`@microservices-sh/storage-entitlements` to atomically reserve per-customer quota,
then release the reservation if the file-media flow fails. Staff routes require `role === "staff"` from `ADMIN_EMAILS`. Local dev can still use explicit
`?role=staff` / `?role=customer` links for demo data.

## Data Wiring

`src/hooks.server.ts` builds the module dependencies and injects them through
`event.locals`. With `DB`/`MEDIA_BUCKET` bindings it uses D1/R2 adapters; without
them it uses in-memory adapters seeded by `src/lib/server/demo.ts` so the portal
renders real, module-produced data locally. The seed drives the modules' own use
cases (no domain logic lives in the template).

## Verification

```bash
pnpm check:spec
pnpm --filter @microservices-sh/invoice check:spec
pnpm --filter @microservices-sh/file-media check:spec
pnpm --filter @microservices-sh/storage-entitlements check:spec
pnpm build:app
pnpm microservices local setup
pnpm dev
```

## Pending Before Beta

1. Add broader D1/R2 migration coverage for invoice, customer, and audit-log tables.
2. Browser screenshot checks for desktop and mobile.
3. Add payment provider modules behind approval gates.

## Managed Preview Deployment

Preview deploys are approval-gated and routed through the microservices.sh API.
See `scripts/microservices.js` (`deploy preview --plan`, `provision`, `migrate`,
`upload`, `cleanup`). The generated app should not ask users to run
`wrangler login`, create resources, or paste Cloudflare resource ids.

# Agent Guide: Client Portal SvelteKit

This template is a scaffold for an auth-gated Cloudflare SvelteKit client portal.

Domain behavior is imported from `@microservices-sh/invoice`,
`@microservices-sh/file-media`, `@microservices-sh/customer`,
`@microservices-sh/storage-entitlements`, `@microservices-sh/audit-log`,
`@microservices-sh/identity`, and `@microservices-sh/email`. Do not recreate
module internals inside this template.

## First Safe Commands

```bash
pnpm microservices modules list --json
pnpm microservices docs invoice
pnpm microservices upgrade invoice --plan --json
pnpm microservices check --json
pnpm microservices local setup
pnpm dev
pnpm microservices auth status
pnpm microservices deploy doctor
pnpm microservices deploy preview --plan
```

## Rules

1. Read `microservices.template.json`, `microservices.lock.json`, and `docs/llms.txt` before editing.
2. Keep SvelteKit `+page.server.ts` / `+server.ts` handlers thin.
3. Put billing behavior in `modules/invoice/src/use-cases`.
4. Put document/file behavior in `modules/file-media/src/use-cases`.
5. Put account behavior in `modules/customer/src/use-cases`.
6. Put quota, packages, and share-link behavior in `modules/storage-entitlements/src/service`.
7. Put Cloudflare/D1/R2/provider details behind module adapters.
8. Scope every customer-facing read to the session `customerId`; for files, pass it as `ownerId` to file-media and storage-entitlements.
9. Prefer config, then hooks, then overlays, then forks.
10. Do not request or print secret values.
11. Ask for approval before provider modules, webhooks, managed remote resources, preview deploy, or production deploy.
12. Do not ask template users to run `wrangler login`, create resources, or paste Cloudflare resource ids for managed preview.
13. In CI, use `MICROSERVICES_API_KEY` with `pnpm microservices deploy preview --confirm deploy --ci --json --output deployment.json`.

## Current Status

The template has a runnable SvelteKit app shell; invoice, file-media,
storage-entitlements, customer, audit-log, identity, email, and gateway module dependencies; D1/R2 and memory
adapters from the modules; passwordless identity login; a customer portal
(dashboard, invoices, owner-scoped files with quota-gated two-step upload) and a staff admin
side (overview, invoices, customers); and local template checks.

Still pending before this is a full beta template:

- broader D1/R2 migrations for invoice, customer, and audit-log persistence
- browser screenshot checks for desktop and mobile
- payment provider modules behind approval gates

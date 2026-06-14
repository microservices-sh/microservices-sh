# Agent Guide: Client Portal SvelteKit

This template is a scaffold for an auth-gated Cloudflare SvelteKit client portal.

Domain behavior is imported from `@microservices-sh/invoice`,
`@microservices-sh/file-media`, `@microservices-sh/customer`,
`@microservices-sh/audit-log`, and `@microservices-sh/auth`. Do not recreate
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
6. Put Cloudflare/D1/R2/provider details behind module adapters.
7. Scope every customer-facing read to the session `customerId`; never leak other customers' data.
8. Prefer config, then hooks, then overlays, then forks.
9. Do not request or print secret values.
10. Ask for approval before provider modules, webhooks, managed remote resources, preview deploy, or production deploy.
11. Do not ask template users to run `wrangler login`, create resources, or paste Cloudflare resource ids for managed preview.
12. In CI, use `MICROSERVICES_API_KEY` with `pnpm microservices deploy preview --confirm deploy --ci --json --output deployment.json`.

## Current Status

The template has a runnable SvelteKit app shell; invoice, file-media, customer,
audit-log, and auth module dependencies; D1/R2 and memory adapters from the
modules; a customer portal (dashboard, invoices, files with two-step upload) and
a staff admin side (overview, invoices, customers); and local template checks.

Still pending before this is a full beta template:

- real `@microservices-sh/auth` session verification (replacing the demo role cookie)
- D1/R2 migrations for managed persistence
- per-customer document scoping (file-media is currently tenant-scoped)
- browser screenshot checks for desktop and mobile
- payment and email provider modules behind approval gates

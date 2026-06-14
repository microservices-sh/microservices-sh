# Agent Guide: Booking SvelteKit

This template is a scaffold for a full Cloudflare SvelteKit booking app.

Booking domain behavior is imported from `@microservices-sh/booking`. Customer behavior is imported from `@microservices-sh/customer`. Do not recreate module internals inside this template.

## First Safe Commands

```bash
pnpm microservices modules list --json
pnpm microservices docs booking
pnpm microservices upgrade booking --plan --json
pnpm microservices check --json
pnpm microservices local migrate
pnpm microservices local dev
pnpm microservices local smoke
pnpm microservices preview deploy --dry-run
```

## Rules

1. Read `microservices.template.json`, `microservices.lock.json`, and `docs/llms.txt` before editing.
2. Keep API route handlers thin.
3. Put booking behavior in `modules/booking/src/use-cases`.
4. Put customer behavior in `modules/customer/src/use-cases`.
5. Put Cloudflare/D1/provider details behind module adapters.
6. Prefer config, then hooks, then overlays, then forks.
7. Do not request or print secret values.
8. Ask for approval before provider modules, remote migrations, webhooks, remote resources, preview deploy, or production deploy.
9. Before preview deploy, run `pnpm microservices preview doctor` and verify `wrangler.jsonc` has real D1 and KV ids instead of `REPLACE_WITH_*` placeholders.

## Current Status

The template now has a minimal runnable SvelteKit app shell, prebuilt booking and customer module dependencies, D1 and memory repository adapters from the modules, public booking routes, admin booking/customer routes, API routes, migrations, and local template checks.

Still pending before this is a full beta template:

- browser screenshot checks for desktop and mobile
- real Cloudflare preview deploy against provisioned D1/KV resources
- real auth/audit modules
- Stripe and email provider modules behind approval gates

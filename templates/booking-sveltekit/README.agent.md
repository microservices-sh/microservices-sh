# Agent Guide: Booking SvelteKit

This template is a scaffold for a full Cloudflare SvelteKit booking app.

Booking domain behavior is imported from `@microservices-sh/booking`. Customer behavior is imported from `@microservices-sh/customer`. Do not recreate module internals inside this template.

## First Safe Commands

```bash
pnpm microservices modules list --json
pnpm microservices docs booking
pnpm microservices upgrade booking --plan --json
pnpm microservices check --json
pnpm microservices local setup
pnpm dev
pnpm microservices local smoke
pnpm microservices auth status
pnpm microservices deploy doctor
pnpm microservices deploy preview --plan
pnpm microservices deploy preview --confirm deploy --output deployment.json
pnpm microservices deploy provision --input deployment.json --confirm provision
pnpm microservices deploy migrate --input deployment.json --confirm migrate
pnpm microservices deploy upload-plan --input deployment.json
pnpm microservices deploy cleanup --input deployment.json --plan
```

## Rules

1. Read `microservices.template.json`, `microservices.lock.json`, and `docs/llms.txt` before editing.
2. Keep API route handlers thin.
3. Put booking behavior in `modules/booking/src/use-cases`.
4. Put customer behavior in `modules/customer/src/use-cases`.
5. Put Cloudflare/D1/provider details behind module adapters.
6. Prefer config, then hooks, then overlays, then forks.
7. Do not request or print secret values.
8. Ask for approval before provider modules, webhooks, managed remote resources, preview deploy, or production deploy.
9. Do not ask template users to run `wrangler login`, create D1/KV resources, or paste Cloudflare resource ids for managed preview.
10. Before managed preview, run `pnpm microservices auth login`, `pnpm microservices deploy doctor`, and `pnpm microservices deploy preview --plan`; use `--confirm deploy`, `--confirm provision`, `--confirm migrate`, `--confirm upload`, and `--confirm cleanup` only after approval.
11. In CI, use `MICROSERVICES_API_KEY` with `pnpm microservices deploy preview --confirm deploy --ci --json --output deployment.json`; chain follow-up commands with `--input deployment.json` and never start an interactive auth flow.

## Current Status

The template now has a minimal runnable SvelteKit app shell, prebuilt booking/customer/auth/gateway/audit module dependencies, D1 and memory repository adapters from the modules, public booking routes, admin booking/customer routes, API routes, migrations, and local template checks.

Still pending before this is a full beta template:

- browser screenshot checks for desktop and mobile
- hosted Worker/assets upload in the control-plane API; D1/KV provisioning, remote migration, and cleanup can be driven by API once a deployment id exists
- hardened auth/gateway/audit onboarding docs
- Stripe and email provider modules behind approval gates

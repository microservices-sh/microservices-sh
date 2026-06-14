# Booking SvelteKit Template

Status: ready local baseline
Template ID: `booking-sveltekit`

This is the official full-app booking template shell. It is intentionally separate from the current Hono API generator and should evolve into the default visual proof template.

Booking behavior comes from `@microservices-sh/booking`. Customer behavior comes from `@microservices-sh/customer`. The template owns only SvelteKit routes, UI, composition glue, and Cloudflare binding wiring.

## Design Rules

- Keep SvelteKit route files thin.
- Put booking and customer behavior in detached module use cases.
- Put Cloudflare/D1/Stripe/email details behind adapters.
- Keep all side-effectful provider modules plan/approval gated.
- Preserve `microservices.lock.json` as the upgrade source of truth.

## Implemented Slice

1. Generated SvelteKit app shell.
2. Consumes detached booking use cases from `@microservices-sh/booking`.
3. Consumes detached customer use cases from `@microservices-sh/customer`.
4. D1 and memory repository adapters.
5. Thin SvelteKit route adapters.
6. Public booking flow.
7. Simple admin overview.
8. Admin booking/customer list and detail routes.
9. Local `pnpm microservices upgrade booking --json` support.
10. Shared workspace spec checks through `packages/workspace-tools`.
11. Local D1 migration and HTTP smoke checks.
12. Preview deploy CLI commands for Cloudflare dry-run, remote D1 migration, and Worker deploy.

## Verification

```bash
pnpm check:spec
pnpm --filter @microservices-sh/customer check:spec
pnpm --filter @microservices-sh/booking check:spec
pnpm build:app
pnpm microservices local migrate
pnpm microservices local dev
pnpm microservices local smoke
pnpm microservices preview deploy --dry-run
```

Run `microservices local smoke` in a second terminal after `microservices local dev` is ready. `microservices local migrate` applies the generated D1 migrations to Wrangler's local database only; remote D1 migrations still require explicit approval. The smoke command verifies the homepage, booking form, availability API, booking creation API, admin overview, booking list/detail, and customer list/detail.

## Preview Deployment

Preview deploys are approval-gated because they create or use remote Cloudflare resources. Before running remote migration or deploy commands:

1. Log in with Wrangler.
2. Create or choose a preview D1 database and KV namespace.
3. Run `pnpm microservices preview bind --d1-id <database-id> --kv-id <namespace-id>`.
4. Run `pnpm microservices preview doctor`.
5. Run `pnpm microservices preview deploy --dry-run`.
6. Run `pnpm microservices preview migrate --confirm migrate`.
7. Run `pnpm microservices preview deploy --confirm deploy`.
8. Run `pnpm microservices preview smoke --url https://<worker-url>`.

Generated apps use their app slug as the Worker name, so separate projects do not all deploy as `booking-sveltekit`.

## Pending Before Beta

1. Run browser screenshot checks for desktop and mobile.
2. Add real auth/audit modules.
3. Add Stripe and email provider modules as gated plans.

## Reference

Use `docs/templates/booking-sveltekit.md` in the root repo as the source spec.

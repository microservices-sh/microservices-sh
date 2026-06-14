# Booking SvelteKit Template

Status: ready local baseline; managed preview onboarding is API-proxy ready, with hosted Worker upload still blocked upstream
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
12. Managed preview CLI commands that proxy deployment intent to the microservices.sh control-plane API.

## Verification

```bash
pnpm check:spec
pnpm --filter @microservices-sh/customer check:spec
pnpm --filter @microservices-sh/booking check:spec
pnpm build:app
pnpm microservices local setup
pnpm dev
pnpm microservices local smoke
pnpm microservices auth status
pnpm microservices deploy preview --plan
```

Run `microservices local smoke` in a second terminal after `pnpm dev` is ready. `pnpm dev` routes through `microservices local dev`, which applies local D1 migrations before starting Vite so `/book` does not fail on a fresh database. `microservices local setup` runs the build and local migration preflight explicitly. Managed remote migrations must stay API-owned and approval-gated. The smoke command verifies the homepage, booking form, availability API, booking creation API, admin overview, booking list/detail, and customer list/detail.

If port 5174 is busy:

```bash
pnpm dev -- --port 5175
pnpm microservices local smoke --url http://127.0.0.1:5175
```

## Managed Preview Deployment

Preview deploys are approval-gated and routed through the microservices.sh API. The generated app should not ask users to run `wrangler login`, create D1/KV resources, or paste Cloudflare resource ids.

1. Run `pnpm microservices auth login` or `pnpm microservices auth login --api-key <key>`.
2. Run `pnpm microservices deploy doctor`.
3. Run `pnpm microservices deploy preview --plan`.
4. Run `pnpm microservices deploy preview --confirm deploy`.
5. Copy the returned deployment id.
6. Run `pnpm microservices deploy provision <deployment-id> --plan`.
7. Run `pnpm microservices deploy provision <deployment-id> --confirm provision`.
8. Run `pnpm microservices deploy upload-plan <deployment-id>`.
9. Run `pnpm microservices deploy status <deployment-id>`.
10. After the API reports a live preview URL, run `pnpm microservices preview smoke --url <preview-url>`.

Remote provisioning and deploy state belong to the API. The local template keeps `wrangler.jsonc` for local Miniflare/D1 development, but managed preview commands do not mutate it with remote resource ids.

Current upstream blocker: the control-plane API can prepare deployments and provision D1/KV when configured, but hosted Worker bundling/upload is still reported as blocked by `deploy upload-plan`. A generated app is ready for local testing now; end-to-end managed preview testing should wait until the API upload adapter is implemented.

## Pending Before Beta

1. Run browser screenshot checks for desktop and mobile.
2. Implement the hosted Worker bundling/upload adapter in the control-plane API.
3. Harden auth/gateway/audit onboarding and browser-facing setup docs.
4. Add Stripe and email provider modules as gated plans.

## Reference

Use `docs/templates/booking-sveltekit.md` in the root repo as the source spec.

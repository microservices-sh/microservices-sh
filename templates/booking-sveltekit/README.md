# Booking SvelteKit Template

Status: ready local baseline; managed preview onboarding proxies artifact upload, resources, migration, and cleanup through the API; hosted Worker upload still needs the deploy-ready bundle/assets adapter
Template ID: `booking-sveltekit`

This is the official full-app booking template shell. It is intentionally separate from the current Hono API generator and should evolve into the default visual proof template.

Booking behavior comes from `@microservices-sh/booking`. Customer behavior comes from `@microservices-sh/customer`. The template owns only SvelteKit routes, UI, composition glue, and Cloudflare binding wiring.

## Styling

The UI uses **Tailwind CSS v4** (CSS-first, no config file). The whole design
system — colors, fonts, radius, shadows — lives in one `@theme` block in
`src/app.css`. Change `--color-accent` to rebrand the whole app. See
[`THEMING.md`](./THEMING.md) for the full guide.

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
4. Run `pnpm microservices deploy preview --confirm deploy --output deployment.json`.
5. Run `pnpm microservices deploy provision --input deployment.json --plan`.
6. Run `pnpm microservices deploy provision --input deployment.json --confirm provision`.
7. Run `pnpm microservices deploy migrate --input deployment.json --plan`.
8. Run `pnpm microservices deploy migrate --input deployment.json --confirm migrate`.
9. Run `pnpm microservices deploy upload-plan --input deployment.json`.
10. Run `pnpm microservices deploy upload --input deployment.json --plan`.
11. Run `pnpm microservices deploy follow --input deployment.json` to watch status/logs until the deployment is live or failed.
12. Run `pnpm microservices deploy status --input deployment.json`.
13. Or pass the returned deployment id directly with `--deployment-id <deployment-id>`.
14. After the API reports a live preview URL, run `pnpm microservices preview smoke --url <preview-url>`.
15. Clean disposable preview resources with `pnpm microservices deploy cleanup --input deployment.json --plan`, then `--confirm cleanup`.

`deploy preview --confirm deploy` runs the local build, runs a local Wrangler dry-run bundle, packages `.microservices/deploy-bundle/_worker.js`, `.svelte-kit/cloudflare` assets, migrations, and project manifests, then uploads that artifact to the API. Remote provisioning, remote D1 migration, Worker/assets upload, preview routing, cleanup, and deploy state belong to the API. The local template keeps `wrangler.jsonc` for local Miniflare/D1 development, but managed preview commands do not mutate it with remote resource ids.

Hosted Worker/assets upload is now API-owned. `deploy upload-plan` reports readiness for the bundled Worker artifact, created D1/KV bindings, Cloudflare credentials, and the managed preview route. `deploy upload --confirm upload` asks the API to upload assets/modules, attach final bindings, create the preview route, and mark the deployment live.

Deploy status is visible through CLI output, `deploy follow`, `deploy status`, and `deploy logs`. `deploy upload --confirm upload` prints the final status and preview URL when the API marks the deployment live. The template does not send async deploy-complete email, webhook, or browser notifications yet; CI should use `--json`, `--output`, and `--wait`/smoke checks.

## CI Preview

CI should use non-interactive auth and machine-readable output:

```bash
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy preview --confirm deploy --ci --json --output deployment.json
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy provision --input deployment.json --confirm provision --ci --json --output provision.json
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy migrate --input deployment.json --confirm migrate --ci --json --output migrate.json
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy upload-plan --input deployment.json --ci --json --output upload-plan.json
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy upload --input deployment.json --confirm upload --ci --json --output upload.json
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy cleanup --input deployment.json --confirm cleanup --ci --json --output cleanup.json
```

Use `--wait --timeout 10m` when CI should wait for the API to report a live preview URL before continuing to smoke tests.

## Pending Before Beta

1. Run browser screenshot checks for desktop and mobile.
2. Add browser-level smoke coverage for managed preview URLs after hosted upload.
3. Harden auth/gateway/audit onboarding and browser-facing setup docs.
4. Add Stripe and email provider modules as gated plans.

## Reference

Use `docs/templates/booking-sveltekit.md` in the root repo as the source spec.

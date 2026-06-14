# microservices.sh

Agent-native application infrastructure. Compose verified Cloudflare-native modules with your own AI agent and deploy production apps without setting up Cloudflare.

The marketing landing site and the control-plane API are maintained in separate repos. This repo is the open-source core: create-app, CLI, SDK, modules, templates, release logic, and governance.

See [`plans/`](./plans) for strategy, MVP scope, architecture, and the landing-page brand brief. See [`plans/20-cli-first-create-app-strategy.md`](./plans/20-cli-first-create-app-strategy.md) for the current CLI-first activation decision. See [`docs/modules`](./docs/modules) for LLM-friendly module docs and [`docs/llms.txt`](./docs/llms.txt) for the agent guide.

Contribution and ecosystem rules live in [`CONTRIBUTING.md`](./CONTRIBUTING.md), [`SECURITY.md`](./SECURITY.md), and [`docs/governance`](./docs/governance). Start with the [module submission guide](./docs/governance/module-submission-guide.md) and [review process](./docs/governance/review-process.md) before opening third-party module or template PRs.

## Monorepo Layout

```
apps/
  api/            Hono Worker — waitlist + analytics; future control plane / MCP
packages/
  cli/            Local agent/developer CLI for the MVP module workflow
  create-microservices-app/ First create-app distribution package
  module-contract/ Static module/template registry and composition contract
  sdk-internal/    Shared SDK used by CLI and future MCP/control-plane surfaces
  workspace-tools/ Reusable repo-local validation commands for modules/templates
modules/
  customer/        Pinned customer module snapshot imported from public modules
  booking/         Pinned booking module snapshot imported from public modules
  email/           Pinned email module snapshot imported from public modules
templates/
  booking-sveltekit/ Official full-app booking template shell
docs/
  modules/         Module reference docs, structure standard, and LLM catalog
  templates/       Template standards and detailed template specs
```

## Recommended Local Repo Layout

Use one parent folder with one Git checkout per repository. Do not nest public repos inside the private core repo.

```text
microservices-sh/
  microservices-sh/   private core repo: create-app, CLI, API/control plane, templates, pinned module snapshots
  landing-page/       private marketing site repo
  dispatcher/         private dispatch Worker repo
```

Modules and templates live in this repo (`modules/`, `templates/`). The CLI vendors module source from here into generated apps — there is no separate module or registry repo.

| Package | Stack | Purpose |
|---------|-------|---------|
| [`packages/cli`](./packages/cli) | Node.js CLI | Agent-friendly local commands with stable `--json` responses |
| [`packages/create-microservices-app`](./packages/create-microservices-app) | Node.js create package | Generates a new app with module docs, lockfile, and project CLI |
| [`packages/module-contract`](./packages/module-contract) | ESM JavaScript + types | MVP module and template contracts |
| [`packages/sdk-internal`](./packages/sdk-internal) | ESM JavaScript + types | Shared implementation for CLI, future MCP Worker, and tests |
| [`packages/workspace-tools`](./packages/workspace-tools) | Node.js CLI | Shared `check` command for module/template package specs |
| [`modules/customer`](./modules/customer) | TypeScript module package | Customer module source (vendored into generated apps) |
| [`modules/booking`](./modules/booking) | TypeScript module package | Booking module source (vendored into generated apps) |
| [`modules/email`](./modules/email) | TypeScript module package | Email module source (vendored into generated apps) |
| [`templates/booking-sveltekit`](./templates/booking-sveltekit) | Cloudflare SvelteKit | Official full-app booking template shell composed from detached customer and booking modules |

## Develop

```bash
pnpm install
pnpm dev:api     # api worker on :8787
pnpm cli -- modules list --json
pnpm cli -- docs booking --json
pnpm cli -- add payment-stripe --plan --json
pnpm cli -- updates --json
pnpm cli -- upgrade booking --plan --json
pnpm cli -- compose booking-business --json
pnpm spec:check -- all
pnpm spec:check -- module modules/booking
pnpm spec:check -- template templates/booking-sveltekit
pnpm scaffold:module -- inventory --json
pnpm scaffold:template -- invoice-sveltekit --framework sveltekit --modules customer --json
pnpm registry:build -- --json
pnpm discover -- --json
pnpm discover -- --path templates/booking-sveltekit --json
pnpm module:customer -- check:spec
pnpm module:booking -- check:spec
pnpm template:booking -- check:spec
pnpm --filter @microservices-sh/template-booking-sveltekit microservices -- check --json
pnpm --filter @microservices-sh/template-booking-sveltekit build:app
pnpm --filter @microservices-sh/template-booking-sveltekit microservices -- local migrate
pnpm --filter @microservices-sh/template-booking-sveltekit microservices -- local dev
pnpm --filter @microservices-sh/template-booking-sveltekit microservices -- local smoke
pnpm create:local -- booking-demo --dir /tmp --no-install
pnpm test:create  # pack/extract/generate smoke test
```

## Local Baseline Flow

The current MVP baseline is a generated app that works locally without login:

```bash
pnpm create microservices-app booking-demo --template booking-sveltekit
cd booking-demo
pnpm microservices modules list --json
pnpm microservices docs booking
pnpm microservices upgrade booking --plan --json
pnpm microservices check --json
pnpm microservices local migrate
pnpm microservices local dev
pnpm microservices local smoke
```

Run `microservices local smoke` in a second terminal after `microservices local dev` starts. Hosted preview/deploy remains approval-gated and is not part of the local baseline gate.

Generated `booking-sveltekit` apps include a preview deploy path once real Cloudflare resources are provisioned:

```bash
pnpm microservices preview doctor
pnpm microservices preview bind --d1-id <database-id> --kv-id <namespace-id>
pnpm microservices preview deploy --dry-run
pnpm microservices preview migrate --confirm migrate
pnpm microservices preview deploy --confirm deploy
pnpm microservices preview smoke --url https://<worker-url>
```

Before remote migration or deploy, bind real D1/KV ids with `microservices preview bind`. The compatibility scripts still exist, but generated app operations should go through `pnpm microservices ...`. The create CLI patches the generated Worker name to the app slug so separate generated apps do not all target the same `booking-sveltekit` Worker.

The create package lives at `packages/create-microservices-app`; use `pnpm create:local -- ...` for repo-local scaffold tests and the repo-local `pnpm cli -- ...` commands for direct SDK/CLI checks.

The first full-app template baseline is `booking-sveltekit`. Future template expansion should happen after this local baseline stays green in CI. Treat templates as predefined starting repositories composed from the same module contracts; likely next candidates are a generated `landing-page` template and `blog-content`. The generated `landing-page` template is separate from the private marketing site repo. Each template should include module docs, lockfile metadata, generated project CLI commands, and upgrade-plan support from day one.

New modules and templates should start from the shared workspace scaffolds instead of copying an existing package:

```bash
pnpm scaffold:module -- inventory
pnpm scaffold:template -- invoice-sveltekit --framework sveltekit --modules customer,booking
pnpm spec:check -- all
```

Local registry and discovery commands are intentionally read-only. `pnpm registry:build -- --json` scans `modules/*/module.json` and `templates/*/microservices.template.json`, then writes derived catalogs under `.generated/registry`. `pnpm discover -- --path <app>` reports installed modules from `microservices.lock.json` and package dependencies so agents can plan changes without mutating source, secrets, resources, or deployments.

## Create-App Release

The create package is prepared for npm distribution through `.github/workflows/npm-publish.yml`.

The workflow is manual and defaults to `dry_run=true`, so it can verify the packed package without publishing. Real npm publication remains gated until the repository has:

- GitHub variable: `NPM_PUBLISH_ENABLED=true`
- GitHub secret: `NPM_TOKEN`

Before the first real publish, confirm the package version, public license choice, and release notes.

## Hosted MCP Preview

The API Worker exposes the first hosted tool contract at `/mcp`.

```bash
pnpm dev:api
curl http://localhost:8787/mcp
```

JSON-RPC tools currently available:

- `list_templates`
- `inspect_template`
- `list_modules`
- `inspect_module`
- `list_module_docs`
- `get_module_doc`
- `plan_add_module`
- `get_secrets_status`
- `check_updates`
- `plan_module_upgrade`
- `compose_app`
- `validate_config`
- `generate_project`
- `run_checks`
- `deploy_dev`
- `deploy_preview`
- `deploy_production`
- `get_deployment_status`
- `get_deployment_artifact`
- `provision_deployment`
- `plan_deployment_upload`
- `activate_deployment`
- `get_deployment_resources`
- `get_logs`

## MVP Agent Workflow

```bash
pnpm cli -- templates list --json
pnpm cli -- templates inspect booking-business --json
pnpm cli -- modules inspect booking --json
pnpm cli -- compose booking-business --json
pnpm cli -- check booking-business --json
pnpm cli -- generate booking-business --out /tmp/booking-business
pnpm cli -- upgrade booking --plan --json
pnpm cli -- doctor --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy dev booking-business --name "Studio Dev" --config '{"appName":"Studio Dev"}' --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy preview booking-business --name "Studio Demo" --config '{"appName":"Studio Demo"}' --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy production booking-business --plan --json
pnpm cli -- deploy production booking-business --confirm production --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy status <deployment-id> --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy artifact <deployment-id> --out /tmp/deployment-artifact --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy doctor --dir /tmp/deployment-artifact --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy pipeline <deployment-id> --dir /tmp/deployment-artifact --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy verify --dir /tmp/deployment-artifact --json
pnpm cli -- deploy provision <deployment-id> [--confirm production] --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy resources <deployment-id> --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy bind <deployment-id> --dir /tmp/deployment-artifact --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy migrate --dir /tmp/deployment-artifact --plan --json
pnpm cli -- deploy upload-plan <deployment-id> --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy upload --dir /tmp/deployment-artifact --dry-run --json
pnpm cli -- deploy activate <deployment-id> --url https://<dispatch-route> --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy domain <deployment-id> --hostname app.customer.com --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy domain-refresh <deployment-id> --hostname app.customer.com --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy logs <deployment-id> --api-url http://127.0.0.1:8787 --json
```

The CLI uses the same internal SDK intended for the hosted MCP server, local stdio MCP package, and future Dockerized MCP wrapper. This keeps agent behavior consistent across access paths.

Use `doctor` for local CLI/API/Wrangler diagnostics and `deploy doctor --dir <artifact-dir>` before running a deployment pipeline. Use `deploy dev` for managed remote iteration, `deploy preview` for shareable review environments, and `deploy production --plan` for the approval checklist before production. `deploy production --confirm production` prepares a production deployment artifact after approval; later provisioning, migration, upload, and activation steps each keep their own production confirmation gates. `deploy artifact` exports the generated project plus `microservices.deployment.json`, which records the Worker entrypoint, scripts, bindings, placeholders, dispatch namespace, and upload readiness for the next adapter. `deploy pipeline` prints the ordered command sequence for a deployment and artifact directory, including the doctor preflight and the right production confirmation tokens. `deploy verify --dir <artifact-dir>` statically checks that exported artifact before bundling or upload. `deploy bind` rewrites exported `wrangler.jsonc` placeholders from created control-plane resources or explicit `--d1`/`--kv` ids. `deploy migrate` runs remote D1 schema execution through Wrangler and requires `--confirm migrate`, or `--confirm production-migrate` for production artifacts. `deploy upload-plan` reports hosted upload readiness, resource blockers, and the current local upload fallback from the control plane. `deploy upload` runs `pnpm exec wrangler deploy` from the artifact directory, adding `--dispatch-namespace` when the artifact targets Workers for Platforms; it dry-runs by default and requires `--confirm upload` to publish dev/preview artifacts or `--confirm production-upload` for production artifacts. `deploy activate` records the dispatch route or live Worker URL back into the control plane. `deploy domain` records a custom domain route and, when `CF_CUSTOM_HOSTNAMES_ENABLED=true`, creates or reads the Cloudflare for SaaS Custom Hostname in the configured SaaS zone. `deploy domain-refresh` polls Cloudflare after DNS changes and updates `deployment_routes` with hostname and certificate status. Provisioning is guarded by Worker configuration, and production provisioning additionally requires `--confirm production`. Without `CF_PROVISIONING_ENABLED=true`, `CLOUDFLARE_ACCOUNT_ID`, and the `CLOUDFLARE_API_TOKEN` secret, `deploy provision` records the requested resources and returns an explicit configuration error. With credentials, the adapter can create D1/KV resources; hosted Worker upload automation is still the next control-plane adapter.

Cloudflare for SaaS automation is optional and separate from D1/KV provisioning. To enable it, set `CF_CUSTOM_HOSTNAMES_ENABLED=true`, `CLOUDFLARE_SAAS_ZONE_ID`, `CF_CUSTOM_HOSTNAME_VALIDATION_METHOD` (`http`, `txt`, or `email`), and the `CLOUDFLARE_API_TOKEN` Worker secret with SSL and Certificates permissions. Customers point DNS at `customers.microservices-sh.site`; Cloudflare customer zones should use a proxied CNAME for O2O, while external providers use a normal CNAME.

## Deploy

Production deploys run through GitHub Actions in `.github/workflows/deploy.yml`.

Required GitHub secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Required GitHub variable:

- `DEPLOY_ENABLED=true`

Optional Worker secrets for Cloudflare for SaaS automation:

- `CLOUDFLARE_SAAS_ZONE_ID`

On `main` push or manual dispatch, the workflow typechecks the API Worker, applies the remote D1 schema, and deploys the API Worker. The marketing landing site deploys from the separate private `microservices-sh/landing-page` repo.

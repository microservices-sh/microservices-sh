# microservices.sh

Agent-native application infrastructure for building Cloudflare-native apps from source-visible, contract-checked modules.

Start with a working app, then let your coding agent inspect the module docs, plan changes, run checks, and deploy when you are ready. Local generation does not require a microservices.sh account or a Cloudflare account.

```bash
pnpm create microservices-app@latest studio-booking --template booking-sveltekit
cd studio-booking
pnpm install
pnpm microservices local setup
pnpm dev
```

Using npm:

```bash
npm create microservices-app@latest studio-booking -- --template booking-sveltekit
```

`studio-booking` is your app directory and slug. The current full-app template id is `booking-sveltekit`.

## What You Get

- A real Cloudflare SvelteKit booking app with public booking flow and admin screens.
- Source-visible modules for gateway, auth, customer, booking, and audit log.
- D1 migrations, Wrangler config, local dev commands, and HTTP smoke checks.
- `microservices.lock.json` to pin module versions and make upgrades reviewable.
- LLM-readable docs under `docs/` so Claude, Codex, Cursor, or another agent can inspect before editing.
- A project CLI exposed as `pnpm microservices` for module discovery, checks, upgrades, local setup, and managed preview deployment requests.

The goal is not to hide generated code behind a platform. The generated project is a normal repo you can read, change, export, and deploy.

## Good Fits

| Use case | Why this repo helps |
|----------|---------------------|
| Solo founder or small business app | Start from a working booking/customer foundation instead of rebuilding auth, data, migrations, and admin flow from scratch. |
| Agency or fractional CTO delivery | Reuse a known production foundation across clients while keeping every generated app inspectable and owned by the client. |
| AI-assisted development | Give your agent stable module contracts, docs, checks, and upgrade plans instead of asking it to invent infrastructure ad hoc. |
| Internal tools and operations portals | Compose common business primitives such as auth, customers, booking, audit logs, email, and payments into Cloudflare-native apps. |
| Module/template contributors | Add new modules and templates behind explicit contracts, tests, docs, and governance rules. |

This is probably not the right fit if you want a no-code builder, a black-box hosted SaaS, or a generic starter template with no upgrade contract.

## Current Catalog

| Item | Status | Notes |
|------|--------|-------|
| `booking-sveltekit` | Ready local baseline | Full Cloudflare SvelteKit app with booking flow, admin views, D1, local smoke tests, and approval-gated preview deploy commands. |
| `booking-business` | Procedural generator | Hono/Worker baseline generated from the module contract. Useful for lower-level CLI and SDK checks. |
| `gateway` | Bundled module | API keys, token issue/verify flow, rate-limit storage adapters. |
| `auth` | Bundled module | Signing keys, JWT mint/verify, JWKS endpoint foundations. |
| `customer` | Bundled module | Customer records, D1 and memory adapters, list/get/upsert use cases. |
| `booking` | Bundled module | Availability, booking creation, cancellation, listing, D1 and memory adapters. |
| `audit-log` | Bundled module | Append-only event recording and listing. |
| `email` | In repo | Transactional email module source; provider workflows remain gated by module maturity and integration checks. |
| `payment` | In repo | Payment module source; Stripe/provider workflows remain gated by approval and integration checks. |

## Local Baseline

After the generated app is running, use a second terminal for smoke checks:

```bash
pnpm microservices local smoke
```

Common generated-app commands:

```bash
pnpm microservices modules list --json
pnpm microservices docs booking
pnpm microservices upgrade booking --plan --json
pnpm microservices add payment-stripe --plan --json
pnpm microservices check --json
```

Managed preview deploys are intentionally approval-gated and routed through the microservices.sh API. The generated app should not ask users to run `wrangler login`, create D1/KV resources, or paste Cloudflare resource ids.

```bash
pnpm microservices auth login
pnpm microservices deploy doctor
pnpm microservices deploy preview --plan
pnpm microservices deploy preview --confirm deploy
pnpm microservices deploy provision <deployment-id> --plan
pnpm microservices deploy provision <deployment-id> --confirm provision
pnpm microservices deploy upload-plan <deployment-id>
pnpm microservices deploy status <deployment-id>
pnpm microservices preview smoke --url https://<worker-url>
```

The generated app is ready for local testing now. End-to-end managed preview remains gated by the hosted control-plane upload adapter; `deploy upload-plan <deployment-id>` reports the current readiness/blockers.

## Repository Map

This repository contains the core create-app, CLI, SDK, modules, templates, release logic, and governance docs. The marketing landing site and hosted control-plane API are maintained in separate repositories.

```text
packages/
  cli/                       Local developer/agent CLI
  create-microservices-app/  npm create package
  module-contract/           Static module/template contract definitions
  sdk-internal/              Shared SDK for CLI, tests, and future hosted surfaces
  workspace-tools/           Repo-local validation and scaffold commands
modules/
  gateway/                   API gateway module
  auth/                      Auth module
  customer/                  Customer module
  booking/                   Booking module
  audit-log/                 Audit log module
  email/                     Email module source
  payment/                   Payment module source
templates/
  booking-sveltekit/         Official full-app booking template
docs/
  modules/                   Module docs and structure standards
  templates/                 Template standards and specs
  governance/                Submission, review, and ecosystem rules
plans/                       Strategy, MVP scope, architecture, and GTM notes
```

If you work across the private/product repos too, keep one checkout per repo under a shared parent folder:

```text
microservices-sh/
  microservices-sh/   core repo
  landing-page/       marketing site repo
  dispatcher/         dispatch Worker repo
```

## Develop This Repo

Requirements:

- Node.js 20+
- pnpm 10+

Install and inspect:

```bash
pnpm install
pnpm cli -- modules list --json
pnpm cli -- docs booking --json
pnpm discover -- --json
pnpm spec:check -- all
```

Run the template from inside the monorepo:

```bash
pnpm --filter @microservices-sh/template-booking-sveltekit microservices -- check --json
pnpm --filter @microservices-sh/template-booking-sveltekit build:app
pnpm --filter @microservices-sh/template-booking-sveltekit microservices -- local setup
pnpm --filter @microservices-sh/template-booking-sveltekit microservices -- local dev
pnpm --filter @microservices-sh/template-booking-sveltekit microservices -- local smoke
```

Test the create package locally:

```bash
pnpm create:local -- studio-booking --template booking-sveltekit --dir /tmp --no-install --no-git
pnpm test:create
```

Create new catalog items from scaffolds:

```bash
pnpm scaffold:module -- inventory
pnpm scaffold:template -- invoice-sveltekit --framework sveltekit --modules customer,booking
pnpm spec:check -- all
```

Local registry and discovery commands are intentionally read-only. `pnpm registry:build -- --json` scans module and template manifests and writes derived catalogs under `.generated/registry`. `pnpm discover -- --path <app>` reports installed modules from `microservices.lock.json` and package dependencies without mutating source, secrets, resources, or deployments.

## Agent And Control-Plane Surfaces

The local CLI and create package use the same internal SDK intended for hosted MCP, local stdio MCP, and deployment-control surfaces. That keeps agent behavior consistent across access paths.

The hosted control-plane API is maintained outside this core repo. It exposes the `/mcp` tool contract and remote deployment endpoints; this repo keeps the shared contracts, generator, SDK, and generated-app client commands.

Representative tool groups:

- Catalog: `list_templates`, `inspect_template`, `list_modules`, `inspect_module`, `list_module_docs`, `get_module_doc`
- Planning: `plan_add_module`, `check_updates`, `plan_module_upgrade`, `validate_config`
- Generation and checks: `compose_app`, `generate_project`, `run_checks`
- Deployments: `deploy_dev`, `deploy_preview`, `deploy_production`, `provision_deployment`, `get_deployment_status`, `get_logs`

Use the repo-local CLI for direct SDK checks. Deployment commands require a configured API URL and auth where they cross into the hosted control plane.

```bash
pnpm cli -- templates list --json
pnpm cli -- templates inspect booking-business --json
pnpm cli -- modules inspect booking --json
pnpm cli -- compose booking-business --json
pnpm cli -- check booking-business --json
pnpm cli -- generate booking-business --out /tmp/booking-business
pnpm cli -- deploy production booking-business --plan --json
```

## Releasing The Create Package

The create package lives at [`packages/create-microservices-app`](./packages/create-microservices-app). Distribution builds bundle the generator into `dist/index.js`:

```bash
pnpm --filter create-microservices-app build
pnpm --filter create-microservices-app pack --dry-run
pnpm --filter create-microservices-app smoke
```

Publishing uses the manual workflow at `.github/workflows/npm-publish.yml`. Default runs use `dry_run=true`. A real npm publish requires:

- GitHub variable: `NPM_PUBLISH_ENABLED=true`
- GitHub secret: `NPM_TOKEN`

The `create-microservices-app` package declares an MIT license. Add/verify the root repository license before describing the entire repository as open source.

## Contributing

Start with:

- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`SECURITY.md`](./SECURITY.md)
- [`docs/governance/module-submission-guide.md`](./docs/governance/module-submission-guide.md)
- [`docs/governance/review-process.md`](./docs/governance/review-process.md)
- [`docs/llms.txt`](./docs/llms.txt)

New modules and templates should include docs, schemas, tests, manifest metadata, generated-project commands, and upgrade-plan support from day one.

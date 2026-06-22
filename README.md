# microservices.sh

[![npm version](https://img.shields.io/npm/v/create-microservices-app.svg)](https://www.npmjs.com/package/create-microservices-app)
[![MCP package](https://img.shields.io/npm/v/%40microservices-sh%2Fmcp?label=MCP)](https://www.npmjs.com/package/@microservices-sh/mcp)
[![Official MCP Registry](https://img.shields.io/badge/MCP%20Registry-sh.microservices%2Fmcp-1f6feb)](https://registry.modelcontextprotocol.io/v0.1/servers?search=sh.microservices/mcp)
[![CI](https://github.com/microservices-sh/microservices-sh/actions/workflows/ci.yml/badge.svg)](https://github.com/microservices-sh/microservices-sh/actions/workflows/ci.yml)
[![Node](https://img.shields.io/node/v/create-microservices-app.svg)](https://nodejs.org)

Production foundations for AI-built Cloudflare apps.

microservices.sh is a System Harness for agent-built apps: source-visible Cloudflare-native modules, local contracts, lockfiles, deterministic checks, project CLI commands, MCP tools, and approval-gated deploy plans.

For developers using Claude Code, Cursor, Codex, or another coding agent on Cloudflare: start from working Workers, D1, and SvelteKit apps with source-visible, contract-checked modules for the dangerous production 30% — auth, identity, payments, webhooks, email, audit logs, tenant boundaries, and deploy checks. Your coding agent can inspect the docs, plan changes, run checks, and prepare deploy plans when you are ready. Local generation does not require a microservices.sh account or a Cloudflare account.

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

- A real Cloudflare SvelteKit booking app with public booking flow, login, payments, and admin screens.
- Source-visible modules for gateway, auth, identity, customer, booking, audit log, and payment, with email/admin/webhooks available as optional additions.
- D1 migrations, Wrangler config, local dev commands, and HTTP smoke checks.
- `microservices.lock.json` to pin module versions and make upgrades reviewable.
- LLM-readable docs under `docs/` so Claude, Codex, Cursor, or another agent can inspect before editing.
- A project CLI exposed as `pnpm microservices` for module discovery, checks, upgrades, local setup, and managed preview-deploy planning.

The goal is not to hide generated code behind a platform. The generated project is a normal repo you can read, change, export, and deploy.

Read the product definition in [What Is microservices.sh System Harness?](./docs/system-harness.md).
The latest clean quickstart proof is recorded in [Quickstart Proof](./docs/quickstart-proof.md).

## Pick A Starter

| Starter | Best for | Includes |
|---------|----------|----------|
| `booking-sveltekit` | Service businesses, appointment products, agency demos | Public booking flow, admin screens, auth, customers, booking, audit log, D1 |
| `saas-starter-sveltekit` | Multi-tenant B2B SaaS apps | Org signup, team RBAC, subscriptions, admin shell, audit log |
| `client-portal-sveltekit` | Customer portals and account areas | Customer auth, invoices, files, audit log |
| `erp-shell-sveltekit` | Internal operations and agency ERP demos | Customers, invoices, files, support tickets, teams, admin, audit log |
| `dot-ai-os` | Private operator pilot workspaces | Tasks, focus plan, calendar, review, knowledge/content pipelines, AI team, contacts, files, support, team RBAC |
| `company-landing-astro` | Static company sites | Astro landing page with content contract, no backend modules |
| `wordpress-emdash-blog-astro` | WordPress blog migrations | Astro + EmDash import path, redirects, RSS, sitemap, D1/R2 |
| `booking-business` | Lower-level Workers/Hono generation | API-first booking baseline generated from module contracts |

## Good Fits

| Use case | Why this repo helps |
|----------|---------------------|
| Technical founder or small business app | Start from a working booking/customer/payment foundation instead of rebuilding auth, data, migrations, and admin flow from scratch. |
| Agency or fractional CTO delivery | Reuse a known production foundation across clients while keeping every generated app inspectable and owned by the client. |
| AI-assisted development | Give your agent stable module contracts, docs, checks, and upgrade plans instead of asking it to invent infrastructure ad hoc. |
| Internal tools and operations portals | Compose common business primitives such as auth, customers, booking, audit logs, email, and payments into Cloudflare-native apps. |
| Module/template contributors | Add new modules and templates behind explicit contracts, tests, docs, and governance rules. |

This is probably not the right fit if you want a no-code builder, a black-box hosted SaaS, or a generic starter template with no upgrade contract.

## Why Agents Work Better Here

- Module docs are generated into the app so the agent can inspect local contracts before editing.
- `microservices.lock.json` pins module versions so upgrades are explicit and reviewable.
- Project commands expose `check`, `add --plan`, `upgrade --plan`, smoke tests, and deploy plans as agent-friendly CLI surfaces.
- Module installs are version-pinned so downgrade/upgrade proposals are explicit instead of hidden in generated code.
- Secrets, migrations, provider actions, and managed deploy plans stay approval-gated.

## CLI And MCP

Use the generated project CLI when you want direct terminal control inside an app. This is the canonical public CLI story for launch because it ships inside the generated project and knows that project's lockfile, modules, and template.

```bash
pnpm microservices modules list --json
pnpm microservices docs booking
pnpm microservices check --json
pnpm microservices deploy run --plan
```

The root repo CLI under `packages/cli` is for internal SDK/control-plane development. Do not use it as the public template demo path until its catalog is synced with the create-package templates.

Use the MCP server when you want Claude, Codex, Cursor, or another MCP client to inspect modules, compose app plans, run checks, and prepare confirmation-gated deploy plans.

```bash
npx -y @microservices-sh/mcp
```

The MCP server is published as [`@microservices-sh/mcp`](https://www.npmjs.com/package/@microservices-sh/mcp) and listed in the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=sh.microservices/mcp) as `sh.microservices/mcp`. The hosted Streamable HTTP endpoint is:

```text
https://api.microservices.sh/mcp
```

## Agent Skill

This repo includes portable agent skills under [`skills/`](./skills). Use them with Codex or another skill-aware coding agent after you generate or inspect an app.

Core workflow skills:

- [`skills/microservices-app-planner`](./skills/microservices-app-planner) - choose a starter, module set, risks, commands, and first checks for a new app idea.
- [`skills/microservices-app-customizer`](./skills/microservices-app-customizer) - customize generated apps through config, hooks, overlays, routes, UI, and content while preserving upgrade boundaries.
- [`skills/microservices-production-readiness`](./skills/microservices-production-readiness) - audit an app before pilot, client handoff, preview, or production.
- [`skills/microservices-provider-setup`](./skills/microservices-provider-setup) - plan and configure provider integrations such as Stripe, email, webhooks, Google Calendar, R2, image generation, and ads.
- [`skills/microservices-data-migration`](./skills/microservices-data-migration) - move app data, auth users, files, and provider records into microservices.sh safely.
- [`skills/microservices-authoring`](./skills/microservices-authoring) - create or update modules, templates, contracts, docs, checks, and registry contributions.

Compatibility and migration-specific skills:

- [`skills/microservices-sh`](./skills/microservices-sh) - work inside a generated app with the original all-in-one workflow skill.
- [`skills/supabase-to-microservices`](./skills/supabase-to-microservices) - migrate a Supabase app (Postgres, Auth, Storage, Realtime, Edge Functions) onto microservices.sh modules backed by D1, R2, Durable Objects, and Workers.
- [`skills/firebase-to-microservices`](./skills/firebase-to-microservices) - migrate a Firebase app (Firestore, Auth, Storage, Cloud Functions, FCM) the same way, modeling documents as relational D1 tables.
- [`skills/prisma-postgres-to-d1`](./skills/prisma-postgres-to-d1) - translate a Prisma + Postgres data layer to Drizzle on D1: schema, query rewrites, and data import.
- [`skills/express-api-to-workers`](./skills/express-api-to-workers) - port an Express/Node API onto the Workers runtime behind module boundaries, covering the runtime gap (no process state, no filesystem, no native DB drivers).
- [`skills/vercel-next-to-cloudflare`](./skills/vercel-next-to-cloudflare) - move a Vercel/Next.js app to Cloudflare: a host-level OpenNext move, or a deeper backend rebuild onto microservices.sh modules.
- [`skills/wordpress-theme-to-astro`](./skills/wordpress-theme-to-astro) - rebuild a WordPress theme as Astro + EmDash components with screenshot-based visual parity gates.

Install from the published GitHub repo with the Skills CLI:

```bash
npx skills add microservices-sh/microservices-sh --skill microservices-sh
```

Install the app-planning skill instead when starting from a product idea:

```bash
npx skills add microservices-sh/microservices-sh --skill microservices-app-planner
```

For a user-level install that is available across projects:

```bash
npx skills add microservices-sh/microservices-sh --skill microservices-sh --global
```

To inspect what the repo exposes before installing:

```bash
npx skills add microservices-sh/microservices-sh --list
```

If you already have this repo checked out locally, you can also install it for Codex by copying the skill folder:

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R skills/microservices-sh "${CODEX_HOME:-$HOME/.codex}/skills/"
```

Or use it directly by asking your agent to use the skill at `skills/microservices-sh` while working inside a generated microservices.sh app.

## Current Catalog

Templates are listed under [Pick A Starter](#pick-a-starter). All modules below are source-visible and contract-checked; run `pnpm microservices modules list` in a generated app (or `pnpm cli -- modules list` here) for live status.

| Module | What it does |
|--------|--------------|
| `gateway` | Public trust boundary: API-key auth, rate limiting, scope narrowing |
| `auth` | EdDSA service-token mint/verify, scope checks, JWKS |
| `identity` | Passwordless email-code login + server-side sessions |
| `idempotency` | Scoped idempotency records for safe retry, replay, and duplicate side-effect prevention |
| `customer` | Customer profiles, contact fields, notes, lifecycle events |
| `booking` | Service booking, availability, booking records, domain events |
| `org-team-rbac` | Multi-tenant orgs, memberships, roles, invitations |
| `billing-subscriptions` | Recurring plans and subscription state on Stripe |
| `payment` | Stripe-backed payment intents and payment records |
| `invoice` | Invoices with gapless atomic numbering, per-line tax, draft→issued |
| `email` | Transactional email with provider-neutral ports (Resend) |
| `notifications-inapp` | Per-user in-app notification feed |
| `webhook-delivery` | Outbound webhook mirror of the event bus |
| `audit-log` | Append-only audit trail / domain-event sink |
| `admin-shell` | Schema-driven admin CRUD over your D1 tables |
| `forms-intake` | Dynamic form builder + intake with validation |
| `file-media` | R2-backed uploads with tenant-scoped keys and upload tickets |
| `image-generation` | Text-to-image across pluggable providers (kie.ai, etc.) |
| `jobs-workflows` | Durable background jobs with idempotent retries |
| `calendar-google` | Google Calendar sync (OAuth, D1) |
| `ads-manager` | Cross-platform ad monitoring (Meta, Google) |

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
pnpm microservices add payment --plan --json
pnpm microservices add payment --apply --json   # writes microservices.config.json + lock after review
pnpm microservices check --json
```

Managed preview deploys are intentionally approval-gated and routed through the microservices.sh API. For the public launch path, present this as deploy planning and readiness inspection unless the hosted control plane has been verified for live Worker/assets upload and route activation.

```bash
pnpm microservices auth login
pnpm microservices deploy run --plan               # preview the managed deploy workflow
pnpm microservices deploy upload-plan --json       # inspect hosted upload readiness
pnpm microservices local smoke --url <preview-url>
```

Need to drive the pipeline by hand (BYO-Cloudflare or debugging)? The granular steps live under `pnpm microservices deploy --help-all`:

```bash
pnpm microservices deploy doctor
pnpm microservices deploy preview --confirm deploy --output deployment.json
pnpm microservices deploy provision --input deployment.json --confirm provision
pnpm microservices deploy migrate --input deployment.json --confirm migrate
pnpm microservices deploy upload --input deployment.json --confirm upload
pnpm microservices deploy status --input deployment.json
pnpm microservices deploy cleanup --input deployment.json --plan
```

The generated app is ready for local testing now. Managed preview commands can prepare deployment records, plan resources, report status, and expose readiness/blockers through the API. End-to-end live hosted preview remains gated by the hosted Worker/assets upload adapter and route activation; `deploy upload-plan --input deployment.json` reports the current readiness/blockers.

For CI, use a workspace API key and keep Cloudflare credentials out of the customer pipeline:

```bash
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy preview --confirm deploy --ci --json --output deployment.json
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy provision --input deployment.json --confirm provision --ci --json --output provision.json
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy migrate --input deployment.json --confirm migrate --ci --json --output migrate.json
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy upload-plan --input deployment.json --ci --json --output upload-plan.json
MICROSERVICES_API_KEY=<workspace-api-key> pnpm microservices deploy cleanup --input deployment.json --confirm cleanup --ci --json --output cleanup.json
```

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
  booking-sveltekit/         Full-app booking template (default)
  saas-starter-sveltekit/    Multi-tenant B2B SaaS starter
  commerce-ops-sveltekit/    Commerce operations template
  accounting-erp-sveltekit/  Accounting ERP template
  dot-ai-os/                 Agent-native operator workspace
  client-portal-sveltekit/   Customer portal (invoices, files)
  company-landing-astro/     Static Astro landing page
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

## Existing Project Migration Handoff

The CLI can prepare an agentic Cloudflare migration handoff for an existing app without calling an AI service. It writes a versioned checklist and prompt, validates the external agent's `report.json`, then generates the next implementation prompt.

```bash
pnpm cli -- analyze /path/to/app --target cloudflare --agent
# Ask your coding agent to use .microservices/analysis/agent-prompt.md
pnpm cli -- doctor --from-report /path/to/app/.microservices/analysis/report.json
pnpm cli -- prompt next --from-report /path/to/app/.microservices/analysis/report.json --goal cloudflare-enable
```

This is intentionally staged. For apps with Supabase, Firebase, Postgres, or existing serverless functions, the first recommendation should usually be Cloudflare-enabled hosting while preserving the current backend, followed by targeted Worker/R2/D1 migrations only when the report has file/line evidence.

## Agent And Control-Plane Surfaces

The local CLI and create package use the same internal SDK intended for hosted MCP, local stdio MCP, and deployment-control surfaces. That keeps agent behavior consistent across access paths.

The hosted control-plane API is maintained outside this core repo. It exposes the `/mcp` tool contract and remote deployment endpoints; this repo keeps the shared contracts, generator, SDK, and generated-app client commands.

Representative tool groups:

- Catalog: `list_templates`, `inspect_template`, `list_modules`, `inspect_module`, `list_module_docs`, `get_module_doc`
- Planning: `plan_add_module`, `check_updates`, `plan_module_upgrade`, `validate_config`
- Generation and checks: `compose_app`, `generate_project`, `run_checks`
- Deployments: `deploy_dev`, `deploy_preview`, `deploy_production`, `provision_deployment`, `migrate_deployment`, `plan_deployment_upload`, `upload_deployment`, `cleanup_deployment`, `get_deployment_status`, `get_deployment_resources`, `get_logs`

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

- npm Trusted Publisher configured for this repository and workflow.
- A tag push such as `create-microservices-app@0.4.0`, or a manual workflow run with `dry_run=false`.

The `create-microservices-app` package declares an MIT license. Add/verify the root repository license before describing the entire repository as open source.

## Contributing

Start with:

- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`SECURITY.md`](./SECURITY.md)
- [`docs/governance/module-submission-guide.md`](./docs/governance/module-submission-guide.md)
- [`docs/governance/review-process.md`](./docs/governance/review-process.md)
- [`docs/llms.txt`](./docs/llms.txt)

New modules and templates should include docs, schemas, tests, manifest metadata, generated-project commands, and upgrade-plan support from day one.

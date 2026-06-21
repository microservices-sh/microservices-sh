# create-microservices-app

[![npm version](https://img.shields.io/npm/v/create-microservices-app.svg)](https://www.npmjs.com/package/create-microservices-app)
[![npm downloads](https://img.shields.io/npm/dm/create-microservices-app.svg)](https://www.npmjs.com/package/create-microservices-app)
[![license](https://img.shields.io/npm/l/create-microservices-app.svg)](https://www.npmjs.com/package/create-microservices-app)
[![node](https://img.shields.io/node/v/create-microservices-app.svg)](https://nodejs.org)

Create a production-shaped Cloudflare app foundation in one command.

`create-microservices-app` is the local entry point for the [microservices.sh System Harness](../../docs/system-harness.md): source-visible modules, local contracts, lockfiles, checks, approval-gated plans, and a project CLI that stays with the generated app.

## Quick start

```bash
# npm (note the `--` before flags)
npm create microservices-app@latest my-app -- --template booking-sveltekit

# pnpm
pnpm create microservices-app my-app --template booking-sveltekit

# guided prompts (name, template, modules, package manager)
npm create microservices-app@latest
```

Requires **Node.js >= 20**. The first argument (`my-app`) is the app directory and slug.

The current clean quickstart proof is recorded in [`docs/quickstart-proof.md`](../../docs/quickstart-proof.md).

## What you get

- A Cloudflare Workers runtime — Hono (`booking-business`) or a full SvelteKit app (`booking-sveltekit`)
- D1 schema + `wrangler.jsonc` local-dev config
- Contract-checked microservices.sh modules wired in or planned through `add --plan`
- `microservices.lock.json` and LLM-readable module docs under `docs/`
- A project CLI exposed as `<pm> microservices` — `modules list`, `add --plan`, `upgrade --plan`, `check`, `updates`, and managed deploy-plan commands

## Why this

Most starters hand you a framework repo and leave the agent to invent the production boundary. This package gives your agent a checked Cloudflare-native foundation:

- **Edge-native by default** — Cloudflare Workers + D1, deployed to the edge, no separate database service to provision.
- **Source-visible modules, not a black box** — auth, booking, payment, email, billing, and more are real contract-checked modules you can read, upgrade (`add --plan` / `upgrade --plan`), and own.
- **A CLI that stays with the project** — `<pm> microservices` keeps managing modules, checks, and managed deploy plans after scaffolding, instead of running once and disappearing.

### Compared to other starters

| | create-microservices-app | `create-t3-app` | Generic SaaS boilerplate |
|---|---|---|---|
| Runtime | Cloudflare Workers (edge) | Node / serverless | Node / Vercel |
| Database | Cloudflare D1 (built in) | bring your own (Postgres) | bring your own |
| Backend modules | contract-checked, upgradeable | none (libraries only) | copy-paste, you maintain |
| Post-scaffold CLI | yes (`<pm> microservices`) | no | no |
| Frontend | SvelteKit or Hono | Next.js | varies |

See the full breakdown at [microservices.sh/compare/create-t3-app](https://microservices.sh/compare/create-t3-app).

## Templates

Pass with `--template <id>`. Default is `booking-sveltekit`.

| id | What it is |
|----|------------|
| `booking-sveltekit` | Full Cloudflare SvelteKit booking app — public flow, admin, D1, typed hooks (default) |
| `booking-business` | Cloudflare Worker / Hono booking app, generated from the module contract |
| `saas-starter-sveltekit` | Multi-tenant B2B SaaS starter (SvelteKit) — org sign-up, team RBAC, subscriptions, admin, audit log |
| `client-portal-sveltekit` | SvelteKit client portal — customers see their own invoices and files; auth, customer, audit-log |
| `erp-shell-sveltekit` | SvelteKit ERP shell - customers, invoices, files, support tickets, teams, admin, audit-log |
| `company-landing-astro` | Static Astro company landing page, no backend modules |
| `wordpress-emdash-blog-astro` | Astro + EmDash WordPress blog migration template with D1/R2-ready content pipeline |
| `nextjs` `astro` `react-router` `nuxt` `hono` `sveltekit` | Empty Cloudflare framework starters (via C3); add modules afterward |

## Options

| Flag | Description |
|------|-------------|
| `--template <id>` | Template id (default `booking-sveltekit`) |
| `--list-templates` | List available template ids and metadata |
| `--category <name>` | Filter template list by category |
| `--search <text>` | Filter template list by id, name, category, or summary |
| `--include-private` | Include exact-id private templates in template listing |
| `--modules <ids>` | Comma-separated extra module ids to enable |
| `--config '<json>'` | Template config override |
| `--git-repo <url>` | Run `git init` and add an `origin` remote |
| `--no-git` | Skip git setup |
| `--interactive` | Force the guided prompts |
| `--package-manager <name>` | `npm`, `pnpm`, `yarn`, or `bun` (auto-detected) |
| `--dir <path>` | Parent directory (default: current directory) |
| `--no-install` | Write files without installing dependencies |
| `--json` | Machine-readable output |

```bash
npm create microservices-app@latest -- --list-templates
npm create microservices-app@latest -- --category saas
npm create microservices-app@latest shop -- --template booking-business --modules audit-log
npm create microservices-app@latest shop -- --git-repo git@github.com:acme/shop.git
```

Module ids are validated against the live registry — run `<pm> microservices modules list` to see what's available. Unknown ids that are *known but not yet generated* come back as follow-up `add --plan` commands.

## After scaffolding

For the SvelteKit template:

```bash
cd my-app
pnpm microservices local setup   # applies migrations to local D1
pnpm dev                         # http://127.0.0.1:5174
pnpm microservices local smoke   # in a second terminal
```

Explore and evolve the project at any time:

```bash
pnpm microservices modules list --json
pnpm microservices add payment --plan --json
pnpm microservices add billing-subscriptions --plan --json
pnpm microservices upgrade booking --plan --json
pnpm microservices check --json
pnpm microservices updates --json
```

## Deploying

Generated apps include managed, approval-gated deploy planning commands that proxy to the microservices.sh control plane. For public launch copy, describe this as deploy planning/readiness unless live hosted Worker/assets upload and route activation have been verified:

```bash
pnpm microservices auth login
pnpm microservices deploy run --plan            # preview the managed deploy workflow
pnpm microservices deploy upload-plan --json    # inspect hosted upload readiness
```

The control plane owns remote state and resource ids; `wrangler.jsonc` stays a local-dev config. End-to-end live hosted previews remain gated by the hosted upload adapter and route activation path. The granular `provision → migrate → upload` steps (and BYO-Cloudflare via `--cloudflare-config`) live under `pnpm microservices deploy --help-all`.

## Which CLI To Use

The generated project CLI, `<pm> microservices`, is the public launch path. It is copied into the app, reads the app's lockfile, and exposes the module/check/deploy-plan commands the app actually supports.

The root `@microservices-sh/cli` workspace package is for internal SDK and control-plane development. Do not use it in public template demos until its catalog is synced with the create-package registry.

## Telemetry

The create command and generated project CLI collect anonymous, opt-out usage events for create/install/check/start/auth funnel statistics. They do not send code, paths, project names, secrets, environment values, or personal data. Disable with `MICROSERVICES_TELEMETRY=0` or `DO_NOT_TRACK=1`.

## Maintainer Notes

Template distribution metadata lives in `src/template-registry.js`:

- `visibility`: `public`, `private`, or `internal`
- `distribution`: `bundled`, `registry`, `private`, or `local`
- `category`: product grouping for guided discovery
- `weight`: `light`, `standard`, or `heavy`

Current `bundled` templates are shipped inside the public npm package. Private bundled templates are hidden from public lists but are still present in the tarball for exact-id scaffolding. Move sensitive or very large templates to a registry/private distribution path before relying on `visibility: private` for confidentiality.

Use the package-size guard before publishing or after adding templates/modules:

```bash
pnpm --filter create-microservices-app build
pnpm --filter create-microservices-app pack:size
```

Override CI thresholds with `MICROSERVICES_CREATE_PACK_MAX_BYTES` and `MICROSERVICES_CREATE_PACK_MAX_FILES`. Smoke tests are split as `smoke:bundle` for full rebuild + pack, `smoke:built` for prebuilt pack checks, and `smoke:network` for network-gated framework downloads.

## Links

- Website & docs: https://microservices.sh
- Issues: https://github.com/microservices-sh/microservices-sh/issues

MIT licensed.

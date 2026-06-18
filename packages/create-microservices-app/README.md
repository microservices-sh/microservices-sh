# create-microservices-app

[![npm version](https://img.shields.io/npm/v/create-microservices-app.svg)](https://www.npmjs.com/package/create-microservices-app)
[![npm downloads](https://img.shields.io/npm/dm/create-microservices-app.svg)](https://www.npmjs.com/package/create-microservices-app)
[![license](https://img.shields.io/npm/l/create-microservices-app.svg)](https://www.npmjs.com/package/create-microservices-app)
[![node](https://img.shields.io/node/v/create-microservices-app.svg)](https://nodejs.org)

Scaffold a Cloudflare-native SaaS app - Workers, D1, SvelteKit or Hono, with source-visible [microservices.sh](https://microservices.sh) modules and a project CLI - in one command.

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

## What you get

- A Cloudflare Workers runtime — Hono (`booking-business`) or a full SvelteKit app (`booking-sveltekit`)
- D1 schema + `wrangler.jsonc` local-dev config
- Contract-checked microservices.sh modules wired in or planned through `add --plan`
- `microservices.lock.json` and LLM-readable module docs under `docs/`
- A project CLI exposed as `<pm> microservices` — `modules list`, `add --plan`, `upgrade --plan`, `check`, `updates`, and managed deploy commands

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
| `nextjs` `astro` `react-router` `nuxt` `hono` `sveltekit` | Empty Cloudflare framework starters (via C3); add modules afterward |

## Options

| Flag | Description |
|------|-------------|
| `--template <id>` | Template id (default `booking-sveltekit`) |
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

Generated apps include managed, approval-gated deploy commands that proxy to the microservices.sh control plane — no `wrangler login`, no manual D1/KV ids:

```bash
pnpm microservices auth login
pnpm microservices deploy run --plan            # preview the managed deploy
pnpm microservices deploy run --confirm deploy  # build + deploy, wait for live
```

`deploy run` prepares the deployment and waits for the control plane to take it live. The control plane owns remote state and resource ids; `wrangler.jsonc` stays a local-dev config. The granular `provision → migrate → upload` steps (and BYO-Cloudflare via `--cloudflare-config`) live under `pnpm microservices deploy --help-all`. See the [deployment docs](https://microservices.sh/docs) for CI usage.

## Telemetry

The create command and generated project CLI collect anonymous, opt-out usage events for create/install/check/start/auth funnel statistics. They do not send code, paths, project names, secrets, environment values, or personal data. Disable with `MICROSERVICES_TELEMETRY=0` or `DO_NOT_TRACK=1`.

## Links

- Website & docs: https://microservices.sh
- Issues: https://github.com/microservices-sh/microservices-sh/issues

MIT licensed.

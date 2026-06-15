# create-microservices-app

[![npm version](https://img.shields.io/npm/v/create-microservices-app.svg)](https://www.npmjs.com/package/create-microservices-app)
[![npm downloads](https://img.shields.io/npm/dm/create-microservices-app.svg)](https://www.npmjs.com/package/create-microservices-app)
[![license](https://img.shields.io/npm/l/create-microservices-app.svg)](https://github.com/microservices-sh/microservices-sh/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/create-microservices-app.svg)](https://nodejs.org)

Scaffold a Cloudflare-native SaaS app — Workers, D1, SvelteKit or Hono, with verified [microservices.sh](https://microservices.sh) modules (auth, booking, payment, email) and a project CLI — in one command.

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
- Verified microservices.sh modules wired in (auth, customer, booking, payment, email, …)
- `microservices.lock.json` and LLM-readable module docs under `docs/`
- A project CLI exposed as `<pm> microservices` — `modules list`, `add --plan`, `upgrade --plan`, `check`, `updates`, and managed deploy commands

## Templates

Pass with `--template <id>`. Default is `booking-business`.

| id | What it is |
|----|------------|
| `booking-business` | Cloudflare Worker / Hono booking app, generated from the module contract (default) |
| `booking-sveltekit` | Full Cloudflare SvelteKit booking app — public flow, admin, D1, typed hooks |
| `company-landing-astro` | Static Astro company landing page, no backend modules |
| `nextjs` `astro` `react-router` `nuxt` `hono` `sveltekit` | Empty Cloudflare framework starters (via C3); add modules afterward |

## Options

| Flag | Description |
|------|-------------|
| `--template <id>` | Template id (default `booking-business`) |
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
npm create microservices-app@latest shop -- --template booking-business --modules payment,email
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
pnpm microservices upgrade booking --plan --json
pnpm microservices check --json
pnpm microservices updates --json
```

## Deploying

Generated apps include managed, approval-gated deploy commands that proxy to the microservices.sh control plane — no `wrangler login`, no manual D1/KV ids:

```bash
pnpm microservices auth login
pnpm microservices deploy preview --plan
pnpm microservices deploy preview --confirm deploy
```

The control plane owns remote state and resource ids; `wrangler.jsonc` stays a local-dev config. See the [deployment docs](https://microservices.sh/docs) for the full provision → migrate → upload pipeline and CI usage.

## Links

- Website & docs: https://microservices.sh
- Issues: https://github.com/microservices-sh/microservices-sh/issues

MIT licensed.

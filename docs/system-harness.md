# What Is microservices.sh System Harness?

microservices.sh System Harness is a contract-driven development environment for agent-built Cloudflare apps.

It is not another prompt-to-app builder, no-code tool, generic SaaS boilerplate, or connector marketplace. Use any coding agent you already like. microservices.sh gives that agent a safer production substrate: source-visible modules, contracts, lockfiles, local checks, upgrade plans, and approval gates.

## The Problem
Coding agents are useful for screens, routes, glue code, and local changes. The weak spot is the production boundary:

- auth and identity
- tenant and customer boundaries
- billing and payments
- migrations and data shape
- webhooks and provider side effects
- audit logs
- deploy planning and rollback
- secrets and environment configuration

Without a harness, the agent has to invent those rules inside each app.

## The Harness
The harness gives agents stable surfaces to inspect and act through:

| Surface | Purpose |
|---------|---------|
| `create-microservices-app` | Generate a source-visible Cloudflare app foundation locally, with no account required. |
| Project CLI | Run app-local module discovery, docs lookup, add/upgrade plans, checks, local setup, smoke checks, and deploy-plan commands. |
| Module contracts | Describe resources, permissions, events, hooks, secrets, schemas, surfaces, and approval gates. |
| `microservices.lock.json` | Pin the template and module versions so upgrades are explicit and reviewable. |
| MCP server | Let MCP-capable clients inspect modules, compose plans, run checks, and prepare approval-gated actions. |
| Control-plane API | Own hosted preview/deploy state where configured; public claims should stay to planning/readiness unless live hosted upload and routing have been verified. |

## Canonical Public Workflow
Start with the create package and generated project CLI:

```bash
pnpm create microservices-app@latest studio-booking --template booking-sveltekit
cd studio-booking
pnpm install
pnpm microservices local setup
pnpm microservices check --json
```

Then use the project-local CLI for changes:

```bash
pnpm microservices modules list --json
pnpm microservices docs booking
pnpm microservices add payment --plan --json
pnpm microservices upgrade booking --plan --json
pnpm microservices deploy run --plan
```

The root workspace CLI in this repository is for internal SDK and control-plane development. Public demos should use `create-microservices-app` plus the generated project CLI until the root CLI catalog is synced with the create-package template registry.

## Deployment Language
Use conservative deployment language until the hosted path is verified end to end.

Safe public wording:

- approval-gated deploy plans
- preview deployment planning
- upload-readiness checks
- BYO Cloudflare/debugging path
- local app source that can be deployed by the user

Avoid until proven live:

- autonomous production deploys
- one-click hosted deploys
- "waits for live" as a default claim
- implied Worker/assets upload and route activation without evidence

## Operator Pilot Boundary
The business-operator lane is promising, but it is not the public launch headline yet. Agent Center, Hermes runtime, and Ads Manager should stay private-pilot examples until runtime creation/status, approval-card persistence, audit history, billing gates, and provider write boundaries are verified end to end. Marketing Research is now an available contract-checked module, but research runs still require approval because they can fetch external signals and call AI providers.

See [Business-Operator Pilot Boundary](./operator-pilot-boundary.md).

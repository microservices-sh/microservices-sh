# Module Submission Guide

> **Process update (2026-06).** The standalone `modules` and `registry` repos this
> guide assumes do **not** exist. Module code is submitted by PR to the monorepo
> `microservices-sh/microservices-sh` under `modules/<id>`; catalog/discovery
> metadata (the retired `registry` repo's old role) now lives in
> `landing-page/src/data/registry/`. Read every `microservices-sh/modules` below
> as the monorepo's `modules/` directory.

Use this guide when proposing or submitting a first-party, verified, or third-party module. Module code is submitted by PR to the monorepo's `modules/` directory; do not put private control-plane code in a module PR.

## Where To Start

| Goal | Start here |
| --- | --- |
| Propose a module idea | Open a module proposal issue in `microservices-sh/modules` |
| List an external module for discovery | Add a listing JSON under `landing-page/src/data/registry/` via PR |
| Add an official module to the platform | Open a proposal issue first, then a PR to `microservices-sh/modules` after maintainer approval |
| Add a provider module such as Stripe or email | Start with proposal and threat/permission review before code |

Do not submit provider code without a proposal. Do not put private control-plane code, production credentials, billing logic, customer data, or deployment config in a public module PR.

## Required Module Shape

A module must be source-visible, documented, testable, and upgrade-aware.

Required package files:

- `module.json`
- `package.json`
- `README.md`
- `README.agent.md`
- `llms.txt`
- `openapi.json`
- `schemas/config.schema.json`
- `schemas/api.schema.json`
- `schemas/events.schema.json`
- `schemas/hooks.schema.json`

Required source folders:

- `src/index.ts`
- `src/types.ts`
- `src/schemas.ts`
- `src/hooks.ts`
- `src/manifest/index.ts`
- `src/config/index.ts`
- `src/schema/index.ts`
- `src/hooks/index.ts`
- `src/events/index.ts`
- `src/permissions/index.ts`
- `src/resources/index.ts`
- `src/service/index.ts`
- `src/ports/index.ts`
- `src/use-cases/`
- `src/adapters/`

Storage-owning modules must include migrations.

## Import-Time Safety

Module imports must be safe.

Do not do these during import:

- read secret values
- call third-party APIs
- create Cloudflare resources
- apply migrations
- send email, SMS, webhooks, or payment requests
- start background jobs
- mutate external state

All side effects must happen through explicit functions called by the generated app, CLI, SDK, MCP tool, or deployment pipeline.

## Provider Module Requirements

Provider modules need stronger review than pure domain modules.

Document:

- required secret names
- provider scopes and permissions
- webhook endpoints
- webhook signature verification
- idempotency and replay behavior
- local/test mode
- production approval gates
- Cloudflare bindings and resources
- migrations and rollback notes
- emitted and consumed events
- failure and retry behavior
- operational limits or provider costs

Credential-only connector modules should stay experimental. A verified provider module should implement a complete workflow.

## Submission Flow

1. Open a module proposal issue.
2. Wait for maintainer triage: accepted, needs research, discovery-only, or declined.
3. If accepted for discovery only, add a listing under `landing-page/src/data/registry/`.
4. If accepted for implementation, scaffold the module in the monorepo's `modules/`:

```bash
pnpm scaffold:module -- <module-id>
```

5. Implement source, docs, schemas, tests, migrations, and examples.
6. Run checks:

```bash
pnpm spec:check -- module modules/<module-id>
pnpm --filter @microservices-sh/<module-id> build
pnpm build
```

7. Open a PR in `microservices-sh/modules` and link the proposal issue.

Maintainers pin accepted module changes as snapshots for create-app, template, and managed platform releases.

## Review Outcomes

Review can result in:

- `needs-info`: proposal is incomplete
- `discovery-only`: module can be listed in the catalog but not owned by core
- `experimental`: module can be tested by early adopters
- `verified`: module meets docs, tests, contract, and security review requirements
- `official`: module is accepted for long-term microservices.sh maintenance
- `declined`: module does not fit product scope or safety standards

Verified and official status require maintainer approval. Contributors should not self-assign those maturity levels.

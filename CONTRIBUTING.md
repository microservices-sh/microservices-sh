# Contributing To microservices.sh

microservices.sh is a CLI-first, agent-native module system for generating and deploying Cloudflare-native app foundations.

This repo is the private core platform monorepo. It owns the create package, project CLI, internal SDK, control plane, official module contracts, pinned module snapshots, and official templates.

## Contribution Paths

Use the smallest path that matches the change:

| Change type | Preferred path |
| --- | --- |
| Bug fix in CLI, SDK, API, templates, or private release glue | Pull request to this repo |
| New third-party module idea | Open a module proposal issue in `microservices-sh/modules` |
| Experimental third-party module | Public module PR or external repo/package plus registry metadata |
| Official verified module | PR to `microservices-sh/modules` after proposal, security review, tests, and ownership are clear |
| New app template | Proposal issue, then template PR or generated template repo |

Do not add broad module marketplaces, dashboard-heavy product surfaces, or unrestricted runtime execution without an accepted design proposal.

Detailed module submission rules are in [`docs/governance/module-submission-guide.md`](./docs/governance/module-submission-guide.md). Public module PRs should target [`microservices-sh/modules`](https://github.com/microservices-sh/modules). Reviewer workflow and approval rules are in [`docs/governance/review-process.md`](./docs/governance/review-process.md).

## Local Checks

Run the focused checks for the area you changed:

```bash
pnpm install
pnpm build
pnpm spec:check:all
pnpm test:create
```

Useful focused commands:

```bash
pnpm cli -- modules list --json
pnpm cli -- check booking-business --json
pnpm spec:check -- module modules/booking
pnpm spec:check -- template templates/booking-sveltekit
pnpm --filter @microservices-sh/template-booking-sveltekit build:app
```

## Pull Request Rules

Every PR should:

- describe the user-facing behavior change
- identify affected surfaces: create package, project CLI, SDK, MCP, API, module, template, docs
- include tests or explain why existing checks are enough
- request at least one non-author reviewer before merge
- keep machine-readable JSON response shapes stable unless the change is explicitly versioned
- avoid unrelated refactors
- avoid committing secrets, API keys, generated local caches, or provider credentials

Mutating production behavior, provider side effects, migrations, webhooks, secrets, billing, email, payment, and deployment changes require explicit non-author review. Do not self-merge these changes. While private-branch protection is unavailable on the current GitHub plan, maintainers must enforce this manually through PR review and the Review Gate checklist.

## Module Snapshot Requirements

New or changed module source should be proposed in `microservices-sh/modules` first. Private core PRs that touch `modules/` should usually import a pinned public module snapshot and link the public commit, tag, or PR.

Modules must be source-visible, documented, and upgrade-aware.

Required files:

- `module.json`
- `package.json`
- `README.md`
- `README.agent.md`
- `llms.txt`
- `openapi.json`
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
- `schemas/config.schema.json`
- `schemas/api.schema.json`
- `schemas/events.schema.json`
- `schemas/hooks.schema.json`
- migrations and tests where the module owns storage or behavior

Module code must not create resources, read secret values, start jobs, call providers, or mutate external state during import. Side effects must happen only through explicit functions called by the generated app, CLI, SDK, MCP tool, or deployment pipeline.

Before requesting review for a private module snapshot PR:

```bash
pnpm spec:check -- module modules/<module-id>
pnpm --filter @microservices-sh/<module-id> build
```

## Third-Party Provider Modules

Provider modules such as Stripe, email, analytics, CRM, or storage integrations must document:

- required secrets by name, never values
- provider permissions and scopes
- Cloudflare resources and bindings
- webhook routes and signature verification
- migrations and rollback notes
- events emitted and consumed
- approval gates for production side effects
- local/test mode behavior
- failure and retry behavior

Credential-only connector PRs are not enough. A provider module should implement a complete workflow with tests, docs, hooks, events, and clear operational boundaries.

## Review Standard

Reviewers should prioritize:

- security and secret handling
- module contract stability
- generated app inspectability
- agent-readable errors and `--json` output stability
- upgrade safety and lockfile behavior
- Cloudflare resource correctness
- tests and local smoke checks

Small, well-scoped PRs are easier to merge than large mixed changes.

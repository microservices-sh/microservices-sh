# Module Docs, Structure, Source Ownership, And Permission Gates

Generated: 2026-06-13

## Purpose

This document consolidates the current decisions around:

- module documentation
- standard module folder structure and entrypoints
- user-modified modules
- third-party provider modules
- credentials, env vars, and secrets
- permission gates
- source-code ownership
- managed Cloudflare deployment namespace
- LLM-accessible docs

## Core Decision

microservices.sh modules are not thin snippets, credential holders, or basic API connectors.

They are full, inspectable, agent-ready implementation packages.

For example, `payment-stripe` should include Stripe customer sync, product and price creation, checkout sessions, payment links, webhook verification, webhook event handling, payment records, refunds, idempotency, schema, migrations, tests, audit events, deployment config, and agent docs.

The word "connector" should be reserved for a low-level internal client or adapter. The product users install should usually be a **provider module**, such as `payment-stripe`, `email-resend`, or `calendar-google`.

## Module Classes

| Class | Meaning | Examples |
|-------|---------|----------|
| Core module | First-party business capability | `auth`, `customer`, `booking`, `audit-log` |
| Provider module | Full third-party SaaS implementation | `payment-stripe`, `email-resend`, `calendar-google`, `accounting-quickbooks` |
| Connector | Low-level internal adapter used by a provider module | Stripe API client, OAuth client, webhook verifier |
| Template pack | Composition of modules for a use case | `booking-business`, `online-store`, `invoice-system` |

## Module Package Standard

Each module should have one canonical code entrypoint:

```text
src/index.ts
```

The entrypoint exports a `moduleDefinition` and typed artifacts. It must be safe to import. Importing a module must not create resources, call third-party APIs, run migrations, read secret values, start jobs, or mutate request-scoped state.

Canonical package layout:

```text
modules/<module-id>/
  module.json
  package.json
  README.md
  README.agent.md
  llms.txt
  openapi.json
  src/
    index.ts
    manifest/index.ts
    routes/index.ts
    service/index.ts
    repository/index.ts
    schema/index.ts
    config/index.ts
    hooks/index.ts
    events/index.ts
    permissions/index.ts
    resources/index.ts
    jobs/index.ts
    webhooks/index.ts
    provider/index.ts
    admin/index.tsx
  schemas/
  migrations/
  seeds/
  tests/
  examples/
```

See `docs/modules/module-package-structure.md`.

Every top-level concern folder should re-export through its own `index.ts`. The module root `src/index.ts` should explicitly re-export the approved public module surface. Leaf files should import from concern folders, not from the module root, to avoid circular imports.

## User-Modified Modules

Use this customization ladder:

1. **Config**: safest and most upgradeable.
2. **Hooks**: typed code extension points.
3. **Overlays**: targeted route/schema/template overrides with merge review.
4. **Fork**: full user-owned module copy; upgrades become manual or agent-assisted.

MVP should support config and hooks first, document overlays, and treat forks as an explicit escape hatch.

The first user-facing module install path should be the project CLI:

```bash
microservices add <module-id> --plan --json
```

That command should fetch docs/metadata, resolve dependencies, explain secrets/resources/permissions, produce a patch plan, and require approval before gated side effects. MCP tools should expose the same behavior after the CLI path is stable.

## Credentials, Env Vars, And Secrets

Separate configuration into four categories:

| Category | Example | Stored In Source | Agent Can See Value |
|----------|---------|------------------|---------------------|
| Public config | `currency=USD`, `slotIntervalMinutes=30` | Yes | Yes |
| Runtime env var | `APP_URL`, `STRIPE_MODE` | Sometimes, if non-secret | Yes, if non-secret |
| Secret | `STRIPE_SECRET_KEY`, `SESSION_SECRET` | Never | No |
| Cloudflare binding/resource | `DB`, `CACHE_KV`, `EMAIL_QUEUE` | Binding names yes, resource ids no by default | Names/status only |

Default secret scope:

```text
workspace/<workspace-id>/project/<project-id>/env/<env>/module/<module-id>/<secret-name>
```

Rules:

- module-private secrets by default
- shared secrets only when explicitly approved
- preview and production secrets are separate
- agents see secret names, scopes, and configured/missing status, not values

## Permission Gates

Agents can propose changes. microservices.sh must gate side effects.

| Risk | Examples | Required Gate |
|------|----------|---------------|
| Low | local docs, local codegen, config-only change | intent confirmation |
| Medium | D1 table, KV namespace, queue, non-secret env var, PII field | user approval and audit log |
| High | payment, email, auth, webhook, API secret, production deploy | explicit approval and audit log |
| Critical | delete data, rotate auth secret, billing change, rollback production | strong confirmation |

Gated actions:

- add module
- add/change secrets
- create paid/provider resources
- create webhooks
- change outbound API domains
- run DB migrations
- access or add PII fields
- change auth/session behavior
- deploy production
- delete or disable resources
- upgrade modules with migrations

## Source-Code Ownership

Default trust model:

> The user owns the source code. microservices.sh proposes and validates changes.

Preferred workflow:

1. User brings a GitHub repo or microservices.sh creates one for them.
2. Agent installs or updates modules on a branch.
3. microservices.sh opens a PR or produces a patch.
4. CI runs checks.
5. Preview deploy is created.
6. User reviews and merges.
7. Production deploy requires explicit approval.

This model is more trustworthy than a black-box builder because developers can inspect, edit, export, and leave.

## Managed Cloudflare Namespace

The MVP managed Cloudflare app Workers should deploy into the Workers for Platforms dispatch namespace:

```text
microservices-sh
```

Use `microservices-sh` as the canonical managed namespace name for generated app Workers.

Future scaling option:

- keep `microservices-sh` as the canonical MVP namespace
- add environment-specific namespaces only if needed, such as `microservices-sh-preview` and `microservices-sh-production`

The dispatch Worker should route app hostnames to user/app Workers inside this namespace. Tags should identify project, workspace, environment, plan, and deployment id.

Recommended Worker naming:

```text
app_<project-id>_<environment>
```

Recommended tags:

```text
workspace:<workspace-id>
project:<project-id>
env:<preview|production>
plan:<free|builder|pro|agency>
deployment:<deployment-id>
```

## Deployment Modes

| Mode | Source Owner | Deployer | MVP Priority | Notes |
|------|--------------|----------|--------------|-------|
| Relay deploy | User repo | User GitHub Actions or connected Cloudflare | High | Best for developer trust. |
| Managed preview | User repo or generated artifact | microservices.sh | High | Uses the `microservices-sh` dispatch namespace. |
| Managed production | User repo remains exportable | microservices.sh | Medium | Higher operational burden. |
| BYO Cloudflare | User repo and user Cloudflare | User or microservices.sh relay | Later | Useful for compliance and advanced teams. |

MVP recommendation:

- managed previews first
- relay production deploys through repo/CI first
- managed production as a paid beta option after trust and support load are understood

## Module Documentation Standard

Each module must have a documentation contract similar to Swagger, but broader.

Required docs:

- Markdown module reference
- `module.json`
- `openapi.json` for public HTTP routes
- config schema
- event schema
- hook schema
- migration notes
- permission and approval matrix
- secrets/env/resource matrix
- source ownership and upgrade notes
- agent checklist

Canonical docs added:

- `docs/llms.txt`
- `docs/modules/README.md`
- `docs/modules/module-spec-standard.md`
- `docs/modules/module-package-structure.md`
- `docs/modules/catalog.json`
- `docs/modules/auth.md`
- `docs/modules/customer.md`
- `docs/modules/booking.md`
- `docs/modules/payment-stripe.md`
- `docs/modules/email.md`
- `docs/modules/audit-log.md`

## LLM Accessibility Requirement

Module docs must be accessible and friendly to LLM agents.

Rules:

- stable file paths and stable module IDs
- one module per Markdown file
- compact machine-readable catalog
- predictable headings
- no required information hidden in images
- examples in fenced JSON
- clear "when to use" and "when not to use"
- explicit secrets and permission gates
- explicit upgrade and source ownership rules
- future MCP/CLI access to the same docs

Planned MCP/CLI doc tools:

- `list_module_docs`
- `get_module_doc`
- `get_module_openapi`
- `get_module_manifest`
- `explain_module_permissions`

## MVP Impact

Before adding more runtime automation, finish the documentation and contract loop:

1. Make current module docs agent-readable.
2. Expose module docs through the project CLI.
3. Add `microservices add <module> --plan` before mutating installs.
4. Add `payment-stripe` as the first serious provider module spec.
5. Expose the same docs/plan tools through MCP.
6. Keep module docs and module registry in sync.
7. Add validation that every available module has docs, manifest metadata, examples, approval metadata, and standard entrypoint structure.
8. Use `microservices-sh` as the managed dispatch namespace for app Worker deployment planning.

## Success Criteria

This slice is successful when:

- an agent can inspect a module without browsing the UI
- an agent can explain required secrets/resources/permissions before install
- an agent can identify the module entrypoint and safe customization files
- an agent can produce an approval plan for `payment-stripe`
- docs and registry data agree on module IDs, status, mount paths, and dependencies
- users can understand source ownership and deployment responsibility before connecting a repo

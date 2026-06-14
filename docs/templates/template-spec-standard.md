# Template Spec Standard

Status: draft
Schema version: `2026-06-13`

## Purpose

A microservices.sh template is a versioned starter repository that combines:

- app shell and framework files
- selected modules
- route/API composition
- Cloudflare bindings and deployment config
- LLM-readable docs
- `microservices.lock.json`
- project CLI commands
- upgrade-plan support

The template must be useful immediately, but flexible enough for an agent to adapt without forking everything.

## Required Manifest

Each template should include `microservices.template.json`.

```json
{
  "schemaVersion": "2026-06-13",
  "id": "booking-sveltekit",
  "version": "0.1.0",
  "status": "draft",
  "displayName": "Booking SvelteKit",
  "category": "business-system",
  "runtime": {
    "language": "typescript",
    "framework": "sveltekit",
    "adapter": "@sveltejs/adapter-cloudflare",
    "platform": "cloudflare-workers",
    "entrypoint": ".svelte-kit/cloudflare/_worker.js"
  },
  "deployment": {
    "defaultMode": "managed-cloudflare",
    "managedNamespace": "microservices-sh",
    "byoCloudflare": "later"
  },
  "modules": {
    "required": ["auth", "customer", "booking", "audit-log"],
    "optional": ["payment-stripe", "email", "admin-shell", "analytics"]
  },
  "slots": {
    "identity": "auth",
    "profile": "customer",
    "scheduling": "booking",
    "audit": "audit-log",
    "payment": null,
    "messaging": null
  }
}
```

## Required Sections

Every template spec must define:

- target user and use case
- included modules and optional modules
- route map and API endpoint map
- data model and migration ownership
- Cloudflare resources and bindings
- secrets/env vars and visibility rules
- permission gates
- customization slots
- upgrade behavior
- generated file tree
- acceptance tests
- non-goals

## Flexibility Model

Templates should support four customization levels.

| Level | Agent Action | Upgrade Impact |
|-------|--------------|----------------|
| Config | Edit `microservices.config.json` or module config files | safest |
| Hooks | Edit documented hook files | usually upgradeable |
| Overlay | Add route/component/schema overlay files | merge review required |
| Fork | Edit module internals | user-owned, manual upgrade |

Agents should prefer config, then hooks, then overlays, then forks.

## Slot Model

Use slots so templates can swap modules without changing the whole app.

Recommended cross-template slots:

- `identity`
- `profile`
- `scheduling`
- `payment`
- `messaging`
- `admin`
- `audit`
- `content`
- `analytics`
- `storage`
- `search`

Each slot should record:

- active module id
- allowed replacement modules
- routes/components using the slot
- secrets/resources introduced by the slot
- events emitted and consumed
- approval gate level

## Generated Project Layout

Use predictable folders so agents can navigate without guessing.

```txt
.
  microservices.template.json
  microservices.config.json
  microservices.lock.json
  README.agent.md
  docs/
    llms.txt
    modules/
    templates/
  src/
    routes/
    lib/
      server/
        modules/
        hooks/
        db/
        events/
        permissions/
      components/
      config/
  migrations/
  tests/
  wrangler.jsonc
```

## Cloudflare Baseline

For full-stack SvelteKit templates, default to:

- Cloudflare Workers with static assets
- `@sveltejs/adapter-cloudflare`
- D1 for relational data
- KV for session/cache/rate-limit placeholders
- R2 only for uploaded files
- Queues only for async email/payment follow-up
- Turnstile only when public form abuse becomes a validation issue

Bindings must be declared in `wrangler.jsonc`, documented in the template spec, and reflected in `microservices.lock.json`.

## Permission Gates

Template commands must require explicit approval before:

- adding auth, payment, email, webhook, PII, migration, queue, or production deploy behavior
- creating or changing Cloudflare resources
- writing secrets
- changing module versions
- applying migrations to remote databases
- enabling external provider webhooks

## Upgrade Requirements

Every template must support:

```bash
pnpm microservices updates --json
pnpm microservices upgrade <module-id> --plan --json
pnpm microservices check --json
```

The upgrade plan must compare the lockfile snapshot against the registry and report:

- version changes
- route changes
- binding/resource changes
- permission changes
- secret changes
- hook changes
- event changes
- migrations likely touched
- overlay/fork review requirements
- files likely touched

## Validation Command

Template packages should use the shared workspace checker instead of owning a custom validation script:

```json
{
  "scripts": {
    "check:spec": "node ../../packages/workspace-tools/src/index.js check template --path ."
  }
}
```

The shared checker validates template metadata, lockfile consistency, local module dependencies, required framework files, and the optional package-specific policy file.

Use `microservices.check.mjs` in the template root only for invariants that are unique to that template.

## Scaffold Command

Start new template packages through the shared scaffold command:

```bash
pnpm scaffold:template -- invoice-sveltekit --framework sveltekit --modules customer,booking
```

The scaffold writes the template manifest, config, lockfile, docs, package scripts, framework starter files, and a small `microservices.check.mjs` policy file.

## Discovery

Local registry discovery reads `templates/*/microservices.template.json` and `microservices.lock.json`:

```bash
pnpm registry:build -- --json
pnpm discover -- --path templates/booking-sveltekit --json
```

Discovery is read-only. It can report installed modules, missing local registry entries, dependency drift, and package dependency mismatches. Integration still requires an explicit plan/apply flow with approval gates.

## Acceptance Criteria

A template is MVP-ready only when:

- local generation succeeds without login
- `pnpm install` succeeds
- local dev starts
- required local migrations are documented and runnable
- HTTP smoke checks pass for UI templates
- typecheck passes
- generated project CLI works
- LLM guide names the first safe actions
- module docs are present and linked
- `upgrade --plan` works from the generated lockfile
- no required secret value is exposed to agents
- all side-effectful actions are approval-gated

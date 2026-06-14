# Module Package Structure Standard

Generated: 2026-06-13

## Decision

Every module should have a predictable package layout and one canonical TypeScript entrypoint.

The entrypoint is:

```text
src/index.ts
```

It exports a module definition. It must not create resources, mutate state, read secrets, start jobs, or call third-party APIs during import.

## Target Package Layout

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
    manifest/
      index.ts
    routes/
      index.ts
      *.ts
    service/
      index.ts
      *.ts
    repository/
      index.ts
      *.ts
    schema/
      index.ts
      api.ts
      records.ts
      events.ts
    config/
      index.ts
    hooks/
      index.ts
      default.ts
      types.ts
    events/
      index.ts
    permissions/
      index.ts
    resources/
      index.ts
    jobs/
      index.ts
      *.ts
    webhooks/
      index.ts
      *.ts
    provider/
      index.ts
      *.ts
    admin/
      index.tsx
      *.tsx
  schemas/
    config.schema.json
    api.schema.json
    events.schema.json
    hooks.schema.json
  migrations/
    0001_initial.sql
  seeds/
    demo.sql
  tests/
    unit/
    integration/
    fixtures/
  examples/
    minimal.config.ts
    hooks.example.ts
  overlays/
    README.md
```

Not every module needs every file. The standard below defines what is required and what is optional.

## Barrel Export Rule

Every top-level folder under `src/` should expose its public surface through an `index.ts` or `index.tsx` file.

Rules:

- `src/index.ts` is the canonical module entrypoint.
- `src/<concern>/index.ts` is the canonical entrypoint for that concern.
- Leaf files may grow freely without changing import paths.
- Prefer named exports over default exports.
- Root exports should be explicit to avoid name collisions.
- Folder barrels may re-export leaf files, but avoid re-exporting secrets, provider clients, or test-only helpers from the root entrypoint.
- Leaf files should not import from `src/index.ts`; this avoids circular imports.

Preferred internal import style:

```ts
import { createCheckoutSession } from "../service";
import { checkoutRequestSchema } from "../schema";
```

Avoid:

```ts
import { createCheckoutSession } from "..";
```

## Required Files

| File | Required | Purpose |
|------|----------|---------|
| `module.json` | Yes | Machine-readable manifest. |
| `package.json` | Yes | Package name, exports, dependencies. |
| `README.md` | Yes | Human module reference. |
| `README.agent.md` | Yes | Agent-specific usage notes. |
| `llms.txt` | Yes | Compact LLM summary and retrieval hints. |
| `openapi.json` | Yes for HTTP modules | Public route contract. |
| `src/index.ts` | Yes | Canonical entrypoint. |
| `src/manifest/index.ts` | Yes | Typed manifest export. |
| `src/routes/index.ts` | Yes for HTTP modules | Hono/OpenAPIHono route export. |
| `src/schema/index.ts` | Yes | Zod/JSON schema exports. |
| `src/config/index.ts` | Yes | Config schema and defaults. |
| `src/hooks/index.ts` | Yes | Hook types and default hook implementations. |
| `src/events/index.ts` | Yes | Events emitted/consumed. |
| `src/permissions/index.ts` | Yes | Permission constants and policy helpers. |
| `src/resources/index.ts` | Yes | D1/KV/R2/Queue/binding declarations. |
| `migrations/` | Yes if D1 is used | Versioned schema changes. |
| `tests/` | Yes | Unit/integration/fixture coverage. |

## Validation Command

Module packages should use the shared workspace checker instead of owning a custom validation script:

```json
{
  "scripts": {
    "check:spec": "node ../../packages/workspace-tools/src/index.js check module --path ."
  }
}
```

The shared checker validates required files, package exports, D1 migration presence, framework-neutral source boundaries, and the optional package-specific policy file.

Use `microservices.check.mjs` in the module root only for invariants that are unique to that module.

## Scaffold Command

Start new module packages through the shared scaffold command:

```bash
pnpm scaffold:module -- inventory --name "Inventory" --summary "Inventory records, stock state, and inventory events."
```

The scaffold writes the standard package files, source folders, JSON schemas, migration placeholder, LLM guide, package exports, shared `check:spec` script, and a small `microservices.check.mjs` policy file.

## Discovery

Local registry discovery reads `modules/*/module.json` and normalizes module package metadata:

```bash
pnpm registry:build -- --json
pnpm discover -- --json
```

Discovery is read-only. It should power planning, update checks, and MCP responses before any integration command mutates source, applies migrations, writes secrets, creates Cloudflare resources, or enables provider side effects.

## Optional Files

| File | Use When |
|------|----------|
| `src/service/index.ts` | Business logic is non-trivial. |
| `src/repository/index.ts` | Module reads/writes D1 directly. |
| `src/jobs/index.ts` | Module has queue/workflow/background jobs. |
| `src/webhooks/index.ts` | Module handles external webhooks. |
| `src/provider/index.ts` | Module integrates a third-party SaaS provider. |
| `src/admin/index.tsx` | Module ships admin UI blocks. |
| `seeds/` | Module has demo fixtures. |
| `examples/` | Module needs sample configs or hooks. |

## Entry Point Contract

`src/index.ts` should export:

```ts
export {
  moduleDefinition,
  manifest,
  routes,
  configSchema,
  defaultConfig,
  resources,
  permissions,
  events,
  hooks,
  migrations,
  tests
};
```

The primary export is `moduleDefinition`.

Example:

```ts
import { defineModule } from "@microservices-sh/runtime";
import { manifest } from "./manifest";
import { routes } from "./routes";
import { configSchema, defaultConfig } from "./config";
import { resources } from "./resources";
import { permissions } from "./permissions";
import { events } from "./events";
import { hooks } from "./hooks";

export const moduleDefinition = defineModule({
  manifest,
  routes,
  configSchema,
  defaultConfig,
  resources,
  permissions,
  events,
  hooks
});

export {
  manifest,
  routes,
  configSchema,
  defaultConfig,
  resources,
  permissions,
  events,
  hooks
};
```

If a concern folder contains multiple leaf files, its `index.ts` owns the local re-exports:

```ts
// src/service/index.ts
export { createCheckoutSession } from "./checkout";
export { createPaymentLink } from "./payment-link";
export { refundPayment } from "./refund";
```

```ts
// src/schema/index.ts
export { checkoutRequestSchema, checkoutResponseSchema } from "./api";
export { paymentRecordSchema } from "./records";
export { paymentSucceededEventSchema } from "./events";
```

## Import Rules

Module import must be safe.

Allowed during import:

- define constants
- define schemas
- define route handlers
- export metadata
- export pure functions

Forbidden during import:

- reading secret values
- calling third-party APIs
- creating D1/KV/R2/Queue resources
- opening network connections
- mutating module-level request state
- starting scheduled work
- running migrations

All side effects must happen through explicit functions called by the generated app, SDK, MCP tool, CLI, or deployment pipeline.

## Runtime Registration

Generated apps should register modules explicitly:

```ts
import { Hono } from "hono";
import { authModule } from "./modules/auth";
import { bookingModule } from "./modules/booking";
import { registerModule } from "./runtime/register";

const app = new Hono<{ Bindings: Env }>();

registerModule(app, authModule, {
  mount: "/auth",
  config: appConfig.auth
});

registerModule(app, bookingModule, {
  mount: "/bookings",
  config: appConfig.booking,
  hooks: bookingHooks
});
```

Do not rely on implicit auto-discovery at runtime. The generator may discover modules at build time, but generated source should show exactly which modules are mounted.

## File Responsibilities

### `manifest/index.ts`

Exports the typed manifest from `module.json`.

Should include:

- id
- version
- class
- summary
- dependencies
- mount
- resources
- secrets and vars
- permissions
- approval risk

### `routes/index.ts`

Exports the Hono/OpenAPIHono router.

Rules:

- route handlers should be thin
- validate input through `schema`
- call service functions for business logic
- emit documented events
- use standard error response shape
- do not read raw secrets unless necessary and explicitly declared

### `service/index.ts`

Holds business logic.

Examples:

- create booking
- calculate availability
- create Stripe checkout
- send email
- record audit event

### `repository/index.ts`

Holds D1 data access.

Rules:

- no HTTP response objects
- no request-specific global state
- idempotency helpers live here if backed by D1

### `schema/index.ts`

Holds Zod or JSON Schema definitions for:

- route params
- request payloads
- responses
- internal records
- event payloads where useful

### `config/index.ts`

Holds:

- config schema
- default config
- config validation helpers

### `hooks/index.ts`

Holds:

- hook type definitions
- default hooks
- hook input/output schemas

Hooks are the preferred customization surface.

### `events/index.ts`

Holds:

- emitted event names
- consumed event names
- event payload schemas
- event version metadata

### `permissions/index.ts`

Holds:

- permission constants
- role-to-permission defaults
- helper for permission checks

### `resources/index.ts`

Holds:

- required Cloudflare bindings
- D1 tables
- KV namespaces
- R2 buckets
- queues
- durable objects
- outbound domains

This file is used by validation and provisioning plans. It must not provision anything by itself.

### `jobs/index.ts`

Optional.

Holds queue/workflow consumers and background jobs.

### `webhooks/index.ts`

Optional.

Holds external webhook verification and dispatch.

Provider modules such as `payment-stripe` should place webhook verification here.

### `provider/index.ts`

Optional.

Holds low-level third-party API client logic.

This is where Stripe/Resend/Google/QuickBooks clients live. Users should install the provider module, not this client directly.

## Overlay Structure

User modifications should live outside the base module when possible:

```text
overlays/
  <module-id>/
    index.ts
    config/
      index.ts
    hooks/
      index.ts
    routes/
      index.ts
    schema/
      index.ts
    README.agent.md
```

Overlay rules:

- config and hooks are upgrade-safe
- route overlays require merge review
- schema extensions require migration review
- direct edits inside `modules/<module-id>/src/` mark the module as forked unless the change is generated by a managed upgrade

## Generated App Layout

The generated app can vendor modules into:

```text
src/modules/<module-id>/
```

or import them from packages:

```text
@microservices-sh/modules-<module-id>
```

MVP recommendation:

- local generated examples may vendor modules for inspectability
- hosted/managed projects should still keep module versions pinned in `microservices.lock.json`
- package import mode can come later when upgrade tooling matures

## Package Exports

Each module package should expose stable exports:

```json
{
  "name": "@microservices-sh/payment-stripe",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./manifest": "./module.json",
    "./openapi": "./openapi.json"
  }
}
```

## Agent Checklist

Before installing or editing a module, an agent should inspect:

- `module.json`
- `README.agent.md`
- `llms.txt`
- `openapi.json`
- `src/index.ts`
- `src/resources/index.ts`
- `src/permissions/index.ts`
- `src/hooks/index.ts`
- migrations
- tests

The agent should then produce a plan listing:

- files changed
- routes added
- resources created
- secrets required
- permissions added
- events emitted/consumed
- approval gates
- checks to run

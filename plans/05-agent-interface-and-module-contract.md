# Agent Interface And Module Contract

## Product Surface
The primary product surface is not the dashboard. It is the interface the user's agent can use.

Required surfaces:

- create package
- project CLI wrapper
- MCP server
- internal TypeScript SDK
- module registry
- template registry
- generated repo
- agent-readable docs

Packaging sequence:

- create package first: `npm create microservices-app@latest` / `pnpm create microservices-app`
- project CLI in the MVP as the agent-friendly local control surface
- hosted Streamable HTTP MCP server after the create/CLI path works
- local stdio MCP package after hosted MCP works
- Dockerized MCP after install/setup friction is proven
- public SDK after module/API contracts stabilize

See `16-cli-sdk-mcp-packaging.md` and `20-cli-first-create-app-strategy.md`.

## MVP MCP Tools
MCP tools should mirror the create package and CLI behavior through the same SDK. Start with:

- `list_templates`
- `inspect_template`
- `list_modules`
- `inspect_module`
- `compose_app`
- `validate_config`
- `generate_project`
- `run_checks`
- `deploy_preview`
- `get_deployment_status`
- `get_logs`
- `promote_production`
- `rollback_deployment`

Defer:

- `install_connector`
- `upgrade_module`
- `diff_customization`
- `estimate_runtime_cost`
- `transfer_to_byo_cloudflare`

## Tool Design Rules
- Every tool response should be structured JSON.
- Every failure should include remediation steps an agent can act on.
- Mutating tools should be explicit about side effects.
- Production deploy must require a confirmation token or equivalent guard.
- Tool names should be stable and boring.
- CLI commands must expose `--json` output with the same stable schemas as MCP tool responses.
- MCP and CLI should share one internal SDK/client layer; do not duplicate business logic across surfaces.

## Module Package Contract
Each module should include:

- `module.json`
- `openapi.json` for public HTTP routes
- `README.md`
- `README.agent.md`
- `llms.txt` or a compact agent summary
- Hono/OpenAPIHono route exports
- route mount metadata
- request/response schemas
- database schema
- migrations
- API routes
- UI components, if applicable
- permissions
- events emitted
- events consumed
- background jobs
- connector requirements
- tests
- seed data
- customization hooks
- upgrade notes
- failure modes

The default backend module shape is a TypeScript Hono module for Cloudflare Workers. Modules should be easy for agents to inspect and compose; avoid framework magic that hides routes, bindings, or side effects.

See `19-module-docs-source-and-permissions.md`, `../docs/modules/module-spec-standard.md`, and `../docs/modules/module-package-structure.md` for the full documentation and package layout standard.

OpenAPI is required for routes, payloads, and responses, but it is not sufficient as the module contract. The module contract must also include secrets, env vars, resources, permissions, approval gates, events, hooks, migrations, source ownership, and upgrade policy.

## Module Package Structure

Every module should have one canonical code entrypoint:

```text
src/index.ts
```

The entrypoint exports `moduleDefinition` and typed artifacts. It must be safe to import. Importing a module must not create resources, call third-party APIs, run migrations, read secret values, start jobs, or mutate request-scoped state.

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

MVP generated examples may vendor modules into `src/modules/<module-id>/` for inspectability, but the long-term module package standard remains directory based.

Each top-level concern folder should re-export through `index.ts`. The module root `src/index.ts` should explicitly re-export the approved public module surface, while leaf files should import from concern folders instead of the module root to avoid circular imports.

## Module Classes

- Core modules: first-party product primitives such as `auth`, `customer`, `booking`, and `audit-log`.
- Provider modules: full third-party service implementations such as `payment-stripe`, `email-resend`, and `calendar-google`.
- Connectors: low-level internal clients used by provider modules. Users should normally install provider modules, not raw connectors.
- Template packs: compositions such as `booking-business`.

`payment-stripe` is a provider module. It should include Stripe product/price creation, checkout, payment links, webhooks, refunds, local records, idempotency, tests, schemas, and docs. It should not be framed as only storing Stripe credentials.

## Example `module.json`
```json
{
  "name": "booking",
  "version": "0.1.0",
  "summary": "Service booking, availability, cancellation, and confirmation workflows.",
  "requires": ["auth", "customer", "email"],
  "optional": ["payment", "staff"],
  "storage": ["d1"],
  "runtime": {
    "framework": "hono",
    "mount": "/bookings",
    "bindings": ["DB", "CACHE_KV", "NOTIFICATIONS"]
  },
  "eventsEmitted": ["booking.created", "booking.confirmed", "booking.cancelled"],
  "eventsConsumed": ["payment.succeeded"],
  "permissions": ["booking.read", "booking.write", "booking.admin"],
  "hooks": [
    "beforeBookingCreate",
    "calculateAvailability",
    "afterBookingConfirmed"
  ],
  "tests": {
    "unit": true,
    "integration": true,
    "fixtures": true
  }
}
```

## Customization Contract
### Config
Safe, upgradeable, and should cover most user needs.

Examples:

- fields
- workflows
- statuses
- labels
- templates
- rules

### Hooks
Controlled code extension points.

Rules:

- typed input/output
- time limits
- no global mutable request state
- no raw secret access unless explicitly scoped
- structured error handling
- tests required

### Fork/Export
Full ownership mode.

Rules:

- user owns code
- upgrades are manual or agent-assisted
- platform support is limited to deployment/runtime unless they stay within module contracts

## Agent Docs Required For Every Module
`README.agent.md` should answer:

- when to use this module
- when not to use it
- required dependencies
- supported customization
- unsafe customization
- common errors
- example prompts
- example tool calls
- test commands
- migration notes

LLM-facing docs must also be retrievable without a browser UI. Required repo docs now include:

- `docs/llms.txt`
- `docs/modules/README.md`
- `docs/modules/catalog.json`
- one Markdown file per module

Future CLI/MCP tools should expose `list_module_docs`, `get_module_doc`, `get_module_openapi`, `get_module_manifest`, and `explain_module_permissions`.

## Example Agent Prompt
```text
Use microservices.sh to create a booking app for a yoga studio.
Use Auth, Customer, Booking, Payment, Email, Admin, and Audit Log.
Customize bookings for class packs, waitlists, cancellation windows, and deposit rules.
Deploy a preview on managed Cloudflare.
```

## Quality Bar
A module is not "verified" unless:

- tests pass
- Hono route exports compile in the Workers runtime
- schema is versioned
- events are documented
- permissions are documented
- customization hooks are typed
- generated app can deploy
- rollback path exists
- agent docs explain failure modes

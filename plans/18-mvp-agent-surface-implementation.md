# MVP Agent Surface Implementation

Generated: 2026-06-13

## Status
The first agent-facing MVP scaffold is implemented locally and through the API Worker.

This now includes the control-plane side of managed preview deployment: project records, generated artifacts, deployment records, planned/created resource records, logs, and disable/status/provision endpoints. The guarded provisioning adapter can create D1/KV resources when Cloudflare credentials are configured. It does not yet upload the generated Worker or return a working preview URL.

Strategic update: the go-forward activation path is now scaffolded as a CLI-first create-app flow before treating MCP as the first onboarding step. The hosted MCP endpoint remains valuable, but the next validation milestone is hardening `npm create microservices-app@latest` / `pnpm create microservices-app` for public distribution.

## Implemented Surfaces
| Surface | Path | Status | Purpose |
|---------|------|--------|---------|
| Module contract | `packages/module-contract` | implemented | Static module/template registry, dependency resolution, composition lock. |
| Internal SDK | `packages/sdk-internal` | implemented | Shared facade for CLI now and MCP/control plane later. |
| CLI | `packages/cli` | implemented | Agent-friendly commands with stable `--json` output. |
| Create package | `packages/create-microservices-app` | scaffolded | First external activation path that generates a local app. |
| Hosted MCP preview | `apps/api/src/mcp.ts` | implemented | JSON-RPC MCP tool adapter over the same SDK methods. |
| Preview control plane | `apps/api/src/control-plane.ts` | implemented | Project, artifact, deployment, resource, status, logs, provision, and disable lifecycle records. |
| Generated example | `generated/examples/booking-business` | implemented | Inspectable Hono/Cloudflare Worker output for the booking-business template. |

## Current Module Registry
MVP available modules:

- `auth`
- `customer`
- `booking`

The booking template references future optional modules:

- `email`
- `payment`
- `admin`
- `audit-log`

Audit is currently implemented as a generated foundation in `src/lib/audit.ts` and `schema.sql`, not as a separate composable module yet.

## Module Docs Status

Canonical module docs now exist under `docs/modules/`.

Current docs:

- `docs/llms.txt`
- `docs/modules/README.md`
- `docs/modules/catalog.json`
- `docs/modules/module-spec-standard.md`
- `docs/modules/module-package-structure.md`
- `docs/modules/auth.md`
- `docs/modules/customer.md`
- `docs/modules/booking.md`
- `docs/modules/payment-stripe.md`
- `docs/modules/email.md`
- `docs/modules/audit-log.md`

These docs are the human and LLM-readable layer for module behavior. The next SDK/MCP slice should expose them through tool calls instead of requiring agents to scrape the repo manually.

## Agent Workflow
From the repo root:

```bash
pnpm cli -- templates list --json
pnpm cli -- templates inspect booking-business --json
pnpm cli -- modules list --json
pnpm cli -- modules inspect booking --json
pnpm cli -- docs booking --json
pnpm cli -- add payment-stripe --plan --json
pnpm cli -- secrets status --json
pnpm cli -- updates --json
pnpm cli -- compose booking-business --json
pnpm cli -- validate booking-business --json
pnpm cli -- check booking-business --json
pnpm cli -- generate booking-business --out generated/examples/booking-business --json
pnpm cli -- deploy preview booking-business --name "Studio Demo" --config '{"appName":"Studio Demo"}' --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy status <deployment-id> --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy provision <deployment-id> --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy resources <deployment-id> --api-url http://127.0.0.1:8787 --json
pnpm cli -- deploy logs <deployment-id> --api-url http://127.0.0.1:8787 --json
```

The CLI intentionally returns SDK response envelopes:

```json
{
  "ok": true,
  "requestId": "local_...",
  "data": {},
  "warnings": []
}
```

Future MCP tools should return the same data shape where practical.

Target external workflow:

```bash
pnpm create microservices-app booking-demo --template booking-business
cd booking-demo
pnpm dev
pnpm microservices modules list --json
pnpm microservices docs booking
pnpm microservices add payment-stripe --plan --json
pnpm microservices secrets status --json
pnpm microservices updates --json
pnpm microservices check --json
```

This target flow should become the primary validation script. The current `pnpm cli -- ...` commands remain the repo-local direct SDK/CLI path.

## Hosted MCP Preview
The API Worker exposes a first `/mcp` endpoint for local and hosted testing.

```bash
pnpm dev:api
curl http://localhost:8787/mcp
```

The endpoint supports these JSON-RPC methods:

- `initialize`
- `ping`
- `tools/list`
- `tools/call`

Available tools:

- `list_templates`
- `inspect_template`
- `list_modules`
- `inspect_module`
- `list_module_docs`
- `get_module_doc`
- `plan_add_module`
- `get_secrets_status`
- `check_updates`
- `compose_app`
- `validate_config`
- `generate_project`
- `run_checks`
- `deploy_preview`
- `get_deployment_status`
- `provision_deployment`
- `get_deployment_resources`
- `get_logs`

This is intentionally a thin protocol adapter over `packages/sdk-internal`.

## Preview Control Plane
The API Worker exposes a prepared-deployment lifecycle:

```bash
pnpm --filter api db:init
pnpm --filter api dev -- --port 8787
curl -X POST http://localhost:8787/deployments/preview \
  -H 'Content-Type: application/json' \
  --data '{"name":"Studio Demo","templateId":"booking-business","actor":"codex","config":{"appName":"Studio Demo","timezone":"America/New_York"}}'
curl http://localhost:8787/deployments/<deployment-id>
curl -X POST http://localhost:8787/deployments/<deployment-id>/provision
curl http://localhost:8787/deployments/<deployment-id>/resources
curl http://localhost:8787/deployments/<deployment-id>/logs
curl -X POST http://localhost:8787/deployments/<deployment-id>/disable
```

Current deployment status semantics:

- `prepared`: generated artifact and deployment record exist, but no live preview URL exists yet.
- `provisioning`: Cloudflare resource creation is in progress.
- `provisioned`: D1/KV resource provisioning completed or was skipped where the next adapter is not implemented; Worker upload is still pending.
- `failed`: a provisioning request failed.
- `disabled`: deployment has been disabled in the control plane.

Current deployment mode:

- `artifact-only`: generated artifact is stored.
- `managed-cloudflare`: deployment has entered the managed Cloudflare provisioning path.

Managed Cloudflare namespace:

- generated app Workers should deploy into the Workers for Platforms dispatch namespace `microservices-sh`
- Worker upload is still pending, so this is currently a documented target rather than active runtime behavior

Provisioning configuration:

- `CF_PROVISIONING_ENABLED=true`
- `CLOUDFLARE_ACCOUNT_ID=<account id>`
- `CLOUDFLARE_API_TOKEN` set with `wrangler secret put CLOUDFLARE_API_TOKEN`

Without those settings, `provision` persists a resource plan and returns `PROVISIONING_NOT_CONFIGURED`. With those settings, the adapter attempts to create D1 and KV resources through Cloudflare API v4 and records each resource as `created` or `failed`. Worker upload is recorded as `skipped` until the bundling/upload adapter exists.

The next adapter should upload the generated Worker, bind the created D1/KV ids, run remote migrations, transition deployments to `ready`, and set `previewUrl`.

## Generated App Shape
The generated booking app includes:

- TypeScript + Hono Worker
- `wrangler.jsonc`
- D1 schema
- KV binding declaration
- Auth signup route
- Customer create/list routes
- Booking availability/create routes
- domain event table
- audit event table
- typed customization hooks
- `microservices.lock.json`
- `README.agent.md`

Important generated files:

- `src/lib/hooks.ts` is the safe customization surface.
- `src/lib/audit.ts` records audit and domain events.
- `microservices.lock.json` records module versions for future upgrade comparison.
- `schema.sql` is the first database migration source.

## Verification
Completed checks:

```bash
pnpm install --offline
pnpm cli -- templates list --json
pnpm cli -- modules list --json
pnpm cli -- compose booking-business --json
pnpm cli -- validate booking-business --json
pnpm cli -- check booking-business --json
pnpm cli -- generate booking-business --out /tmp/microservices-generated-booking --json
pnpm --filter api db:init
pnpm build
pnpm --filter api typecheck
pnpm --filter api exec wrangler deploy --dry-run
pnpm --filter landing-page build
```

Hosted MCP checks:

```bash
pnpm --filter api dev -- --port 8787
curl http://localhost:8787/mcp
curl -X POST http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
curl -X POST http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
curl -X POST http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"inspect_module","arguments":{"id":"booking"}}}'
curl -X POST http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"deploy_preview","arguments":{"name":"MCP Studio","templateId":"booking-business","actor":"codex","config":{"appName":"MCP Studio"}}}}'
curl -X POST http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"provision_deployment","arguments":{"deploymentId":"<deployment-id>"}}}'
```

Generated app verification:

```bash
cd /tmp/microservices-generated-booking
pnpm install --offline
pnpm typecheck
```

Known warnings:

- Landing page build warns that the Cloudflare Astro adapter enables sessions with a `SESSION` KV binding.
- Wrangler is currently v3.114.17 and reports that v4 is available.
- Wrangler dev falls back from compatibility date `2026-06-01` to its bundled runtime date until Wrangler is upgraded.
- `pnpm cli -- check booking-business` reports managed Cloudflare provisioning as pending because Worker upload and route activation are not wired yet.

## Next Engineering Slice
Harden distribution and updates, then expose module docs through MCP and finish the live Cloudflare preview adapter.

Create/manage loop now scaffolded:

- `packages/create-microservices-app` generates into a fresh directory
- generated apps include `README.agent.md`, `docs/llms.txt`, module docs, `microservices.config.json`, and `microservices.lock.json`
- generated apps expose `pnpm microservices`
- generated project CLI supports `modules list`, `modules inspect`, `docs`, `add --plan`, `secrets status`, `updates`, and `check`
- repo CLI exposes matching SDK-backed commands
- all new commands support stable `--json`

Distribution/update hardening still needed:

- add package provenance/release workflow
- add lockfile diff and upgrade-plan command beyond current `updates` status check
- add generated project fixture tests in CI

Distribution hardening now complete:

- create package bundles the internal generator into `dist/index.js`
- packed tarball contains only `dist/index.js`, `package.json`, and `README.md`
- packed manifest has no runtime dependency on `@microservices-sh/sdk-internal`
- extracted tarball can generate a project outside the monorepo

Module-doc tools:

- `list_module_docs`
- `get_module_doc`
- `get_module_openapi`
- `get_module_manifest`
- `explain_module_permissions`

Live preview adapter:

- Worker upload/deploy orchestration
- generated `wrangler.jsonc` binding replacement from created D1/KV ids
- remote D1 migration execution
- status transition from `prepared` to `ready`
- real preview URL assignment
- failure capture and rollback/disable behavior

Do not add more templates or connector modules until at least five external users complete the local booking-app generation flow.

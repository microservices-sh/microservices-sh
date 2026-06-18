# Task Plan: microservices.sh MVP Planning

## Goal
Create actionable planning documents that review the microservices.sh concept, define an MVP, and give the team a validation, development, launch, and measurement plan.

## Current Phase
Phase 30

## Phases

### Phase 1: Requirements And Discovery
- [x] Capture current product concept from conversation.
- [x] Confirm key correction: users may build SaaS apps, but the product should target production applications and business systems broadly.
- [x] Check local planning and Cloudflare guidance.
- [x] Verify current Cloudflare and MCP assumptions against primary docs.
- **Status:** complete

### Phase 2: Strategic Review
- [x] Review positioning, ICP, product scope, and risks.
- [x] Decide MVP wedge and non-goals.
- [x] Define validation gates before heavier platform work.
- **Status:** complete

### Phase 3: Planning Artifacts
- [x] Create root working-memory files.
- [x] Create `plans/` markdown files for strategy, MVP scope, validation, roadmap, architecture, agent interface, GTM, metrics, risks, and interviews.
- **Status:** complete

### Phase 4: Verification
- [x] Check all markdown files exist.
- [x] Check the plan is actionable and internally consistent.
- **Status:** complete

### Phase 5: Delivery
- [x] Summarize created files and recommended next step.
- **Status:** complete

### Phase 6: Proposition And Pricing Consolidation
- [x] Consolidate product proposition, niche, unique selling points, pricing, and competitive pricing frame.
- [x] Create canonical product marketing context.
- [x] Update planning documents with pricing comparison and validation questions.
- **Status:** complete

### Phase 7: Marketing Research Verification
- [x] Use multiple marketing skill lenses to audit the validation plan.
- [x] Check secondary market, competitor, and pricing sources.
- [x] Separate validated signals from assumptions requiring primary research.
- [x] Update validation documents with research status and required interview mix.
- **Status:** complete

### Phase 8: Assumption-Level Validation
- [x] Validate each major assumption using public sources where possible.
- [x] Mark each assumption as validated, partially supported, plausible, or not validated.
- [x] Add required primary tests for assumptions that cannot be validated from desk research.
- **Status:** complete

### Phase 9: MCP Directory Distribution
- [x] Check current MCP directory surfaces.
- [x] Decide whether MCP directories belong in the validation/GTM plan.
- [x] Add readiness gate, submission order, positioning variant, and metrics.
- **Status:** complete

### Phase 10: Landing Page Brand Brief
- [x] Decide how to use the honey bee net concept for the ICP.
- [x] Convert the theme into a conversion-oriented landing page handoff.
- [x] Add design guardrails, copy direction, page structure, and success criteria.
- **Status:** complete

### Phase 11: Hono Cloudflare Runtime Decision
- [x] Review `~/Project/favcrm/v2/api` for Hono/Workers implementation patterns.
- [x] Confirm the correct framing is Hono on Cloudflare Workers with Node.js compatibility, not a normal Node.js server.
- [x] Update architecture, roadmap, and module contract docs with the runtime baseline.
- **Status:** complete

### Phase 12: CLI, SDK, And MCP Packaging
- [x] Decide whether CLI, SDK, and Dockerized MCP are necessary for MVP.
- [x] Sequence hosted MCP, CLI, internal SDK, local stdio MCP, Dockerized MCP, and public SDK.
- [x] Update interface, directory, roadmap, and planning index docs.
- **Status:** complete

### Phase 13: Detailed MVP Execution Plan
- [x] Convert the current strategy into a detailed MVP build plan.
- [x] Define MVP stages, modules, architecture, workflows, metrics, gates, and non-goals.
- [x] Add first 14-day and first 30-day execution checklists.
- **Status:** complete

### Phase 14: MVP Agent Surface Scaffold
- [x] Verify the existing landing page and monorepo work from the other agent.
- [x] Add a static module/template contract package for Auth, Customer, Booking, and the booking-business template.
- [x] Add an internal SDK facade shared by CLI and future MCP/control-plane surfaces.
- [x] Add a CLI with stable `--json` output for list, inspect, compose, validate, check, and generate.
- [x] Generate an inspectable booking-business Hono/Cloudflare Worker example.
- [x] Run package installation and verification checks.
- **Status:** complete

### Phase 15: Hosted MCP Preview Endpoint
- [x] Add `/mcp` metadata and JSON-RPC endpoint to the API Worker.
- [x] Expose `initialize`, `ping`, `tools/list`, and `tools/call`.
- [x] Wire MCP tools to the same internal SDK used by the CLI.
- [x] Verify local runtime calls against Wrangler dev.
- [x] Verify API typecheck and dry-run deploy.
- **Status:** complete

### Phase 16: Preview Deployment Control Plane
- [x] Add D1 tables for projects, generated artifacts, deployments, and deployment logs.
- [x] Add HTTP routes for project creation, preview deployment preparation, status, logs, and disable.
- [x] Add MCP tools for `deploy_dev`, `deploy_preview`, `get_deployment_status`, `get_deployment_artifact`, and `get_logs`.
- [x] Add CLI commands for `deploy dev`, `deploy preview`, `deploy status`, `deploy artifact`, and `deploy logs`.
- [x] Add deployment artifact manifest metadata for Worker entrypoint, scripts, bindings, placeholders, and upload readiness.
- [x] Add CLI artifact verification for exported deployment source before bundling or upload.
- [x] Add CLI binding rewrite for exported deployment artifacts after D1/KV provisioning.
- [x] Add guarded CLI remote D1 migration wrapper for exported deployment artifacts.
- [x] Add guarded CLI upload wrapper around Wrangler deploy for exported artifacts.
- [x] Add deployment activation endpoint, MCP tool, and CLI command to persist live Worker URLs.
- [x] Add hosted deployment upload-plan API, MCP tool, and CLI command before implementing Worker script upload.
- [x] Add CLI deployment pipeline planner for ordered dev/preview/production steps.
- [x] Add CLI doctor diagnostics for API auth, local tooling, Wrangler, and deployment artifact readiness.
- [x] Verify prepared and disabled deployment states locally.
- **Status:** complete

### Phase 17: Guarded Cloudflare Resource Provisioning
- [x] Add D1 table for deployment resource records.
- [x] Derive D1/KV/Worker resource plans from the generated `wrangler.jsonc` artifact.
- [x] Add guarded provisioning that requires `CF_PROVISIONING_ENABLED=true`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN`.
- [x] Add HTTP routes for `POST /deployments/:id/provision` and `GET /deployments/:id/resources`.
- [x] Add MCP tools for `provision_deployment` and `get_deployment_resources`.
- [x] Add CLI commands for `deploy provision` and `deploy resources`.
- [x] Require explicit production confirmation before provisioning production deployments.
- [x] Add explicit production deployment preparation through API, MCP, and CLI.
- [x] Verify local no-credentials provisioning smoke test.
- **Status:** complete

### Phase 18: Module Documentation, Structure, Source Ownership, And Permission Gates
- [x] Define module docs as broader than Swagger/OpenAPI: route contracts plus secrets, resources, permissions, events, hooks, migrations, source ownership, and upgrade policy.
- [x] Add LLM-friendly module docs and catalog under `docs/`.
- [x] Define a standard module package layout with safe `src/index.ts` entrypoint and predictable folders.
- [x] Update module structure to use folder-level `index.ts` re-exports for every top-level concern.
- [x] Reframe third-party SaaS support as full provider modules, not thin credential connectors.
- [x] Define secrets/env/bindings model and permission gates.
- [x] Define source ownership default: user-owned repo with branch/PR or patch workflow.
- [x] Record managed Cloudflare namespace as `microservices-sh` for generated app Workers.
- **Status:** complete

### Phase 19: CLI-First Create App Strategy Audit
- [x] Audit plans for MCP-first activation assumptions.
- [x] Re-sequence MVP activation around `npm create microservices-app@latest` / `pnpm create microservices-app`.
- [x] Define create package vs project CLI responsibilities.
- [x] Move hosted MCP to a first-class parity interface after CLI/create credibility.
- [x] Update validation, GTM, roadmap, success metrics, and module docs direction for CLI-first activation.
- **Status:** complete

### Phase 20: Create-App Distribution And Update Scaffold
- [x] Add `create-microservices-app` workspace package with a binary entrypoint.
- [x] Generate apps into fresh directories with module docs, lockfile, config, and agent guide.
- [x] Add generated project CLI commands for docs, add-plan, secrets, updates, upgrade-plan, and checks.
- [x] Add matching SDK and repo CLI methods for docs, add-plan, secrets, updates, upgrade-plan, and checks.
- [x] Add MCP parity tools for docs, add-plan, secrets, updates, and upgrade-plan.
- [x] Extend `microservices.lock.json` for template, registry, generator, customization metadata, and module contract snapshots.
- [x] Harden npm distribution by bundling the generator and removing runtime workspace dependencies from the published create package.
- [x] Add create-package tarball smoke test for pack, extract, generate, and generated project CLI commands.
- [x] Improve guided setup with numbered template, module, and package-manager selections plus optional Git remote setup.
- [x] Add manual GitHub Actions release workflow with npm provenance support and dry-run default.
- [ ] Configure GitHub repo variable `NPM_PUBLISH_ENABLED=true` and secret `NPM_TOKEN` before real npm publication.
- [ ] Confirm package version, license, and release notes before first public npm publish.
- [x] Add upgrade-plan and lockfile diff commands beyond the current update status check.
- [ ] Add predefined repo-style templates after core upgrade safety is validated.
- **Status:** distribution scaffold complete; npm release workflow added; upgrade-plan core added; npm env, first publish decision, and template expansion pending

### Phase 21: Flexible Template Spec
- [x] Define a standard for predefined repo-style templates.
- [x] Define the first full Cloudflare SvelteKit booking app template spec.
- [x] Keep templates module-backed, source-visible, LLM-documented, and upgrade-plan aware.
- [x] Add `templates/*` to the workspace for official template packages.
- [x] Scaffold `templates/booking-sveltekit` with manifest, config, lockfile, agent docs, API-boundary docs, and booking/customer module dependency wiring.
- [x] Implement runnable SvelteKit app shell with prebuilt booking module use cases, D1 adapter, public booking route, admin overview, and API routes.
- [x] Verify local D1 migrations with Wrangler.
- [x] Verify local dev server behavior with Vite HTTP smoke checks.
- [x] Add admin booking/customer list and detail routes.
- [x] Add reusable template HTTP smoke script for route and API coverage.
- [x] Extract first real prebuilt module package: `@microservices-sh/booking`.
- [x] Rewire `booking-sveltekit` to consume the prebuilt booking module instead of template-local booking internals.
- [x] Extract second real prebuilt module package: `@microservices-sh/customer`.
- [x] Rewire `booking-sveltekit` to compose customer and booking modules with separate repositories.
- [x] Refactor module/template spec validation into one reusable workspace command.
- [x] Add reusable module/template scaffold commands so future packages start from the standard shape.
- [x] Add read-only local registry build and discovery commands for manifests and installed app state.
- [ ] Add browser screenshot checks for desktop and mobile.
- [ ] Add provider module plans for Stripe payment and email.
- **Status:** first runnable booking SvelteKit shell complete; browser screenshot verification and provider modules pending

### Phase 22: Auth-First Account, CLI, And Admin Portal Plan
- [x] Confirm current CLI auth is implemented only as static bearer-token bootstrap.
- [x] Define auth-first prerequisite before billing.
- [x] Define user, workspace, membership, session, API-key, device-code, and audit tables.
- [x] Define portal login, workspace, API-key, and future device-login routes.
- [x] Define CLI auth, workspace, and key-management command plan.
- [x] Define migration from static env keys to D1-backed workspace-scoped API keys.
- [x] Define security defaults, verification, rollout, and billing readiness criteria.
- **Status:** auth-first implementation plan complete; first API auth slice is tracked in Phase 24

### Phase 23: Auth And Billing Plan Review
- [x] Dispatch parallel subagents for auth implementation fit, billing/Stripe sequencing, and planning consistency.
- [x] Consolidate subagent findings with local plan review.
- [x] Identify blocking issues before auth or billing implementation.
- [x] Create `plans/23-auth-billing-plan-review.md` with prioritized findings and remediation order.
- **Status:** review complete; first API auth remediation slice is tracked in Phase 24

### Phase 24: Auth Implementation Phase A/B API Slice
- [x] Tighten the billing plan so auth/account tables stay owned by the auth plan.
- [x] Add D1 auth/account foundation tables to the API schema.
- [x] Add bootstrap internal owner/workspace rows for temporary static-key compatibility.
- [x] Add D1-backed API-key lookup for `Authorization: Bearer` with workspace/scopes.
- [x] Map the temporary static bearer-key fallback to `ws_internal`.
- [x] Add `workspace_id` columns and indexes to control-plane tables in the schema.
- [x] Scope project, deployment, artifact, route, resource, and log reads/writes by workspace.
- [x] Pass workspace context through HTTP routes and hosted MCP tool calls.
- [x] Validate API typecheck and fresh local D1 schema application.
- [x] Add explicit remote D1 migration/backfill for existing deployed control-plane tables. (`migrations/0001_auth_workspace.sql` ALTERs all 6 control-plane tables `ADD COLUMN workspace_id DEFAULT 'ws_internal'`; `db:migrate:remote` script added.)
- [x] Add first-owner bootstrap/API-key creation route or admin command. (`scripts/bootstrap-owner.js` + `pnpm bootstrap:owner[:remote]`; prints raw key once, stores hash only.)
- [x] Add CLI profile/workspace/key-management behavior. (Already in `packages/cli`: `auth login` device-code flow with poll/slow_down handling, `auth login --api-key`, `auth status`/`whoami`/`logout`, token persisted to `~/.microservices/config.json`; plus `billing`/`usage`. Note: lives in `packages/cli`, not `apps/cli`.)

### Phase 25: Agentic Cloudflare Migration Prompt Orchestrator
- [x] Add CLI commands that generate a deterministic Cloudflare migration checklist and agent prompt for existing projects.
- [x] Add report validation and doctor rendering from an external agent-produced `report.json`.
- [x] Add next-prompt generation for staged migration goals such as static SPA enablement, Supabase function migration, R2 storage migration, and CI deploy.
- [x] Add smoke coverage for prompt/checklist/report validation without calling an AI service.
- **Status:** complete
- [~] Add portal sessions, API-key management UI, and CSRF/cookie hardening. (API done: passwordless sessions in `auth-flow.ts`/`portal.ts`, `httpOnly+secure+SameSite=Lax` cookies, CORS origin allowlist. SvelteKit key-management UI still pending — the only open auth item.)
- [x] Add cross-workspace route tests and MCP identity tests. (`api/test/isolation.test.mjs` function-level + `api/test/routes.test.mjs` HTTP/MCP-level via `app.fetch`; 22 tests total, node:sqlite D1. Covers 401 gates, per-route 404 isolation, and MCP identity scoping.)
- **Status:** auth/tenancy, remote migration, bootstrap, portal API, CLI auth, and function+route+MCP isolation tests all complete; only the SvelteKit portal API-key UI remains before billing

### Phase 30: Standalone MCP Package And Directory Distribution
- [x] Split the MCP server into the standalone `microservices-sh/mcp` repository.
- [x] Publish `@microservices-sh/mcp@0.1.1` to npm with Trusted Publisher.
- [x] Validate `server.json` with the official MCP Registry publisher schema.
- [x] Update MCP package defaults and README examples to `https://api.microservices.sh`.
- [x] Open public listing PRs for Awesome MCP Servers, MCPFind, MCPSvr, and Docker MCP Registry.
- [x] Identify blocked/non-PR directories and remaining official registry namespace-auth requirement.
- [x] Publish `sh.microservices/mcp` to the official MCP Registry after DNS authentication.
- **Status:** complete

## Key Questions
1. Is the current plan good enough to start an MVP?
   - Yes, if the MVP stays narrow: one vertical template, managed Cloudflare default, agent-first interface, minimal admin UI, and paid validation gates.
2. What should the product category be?
   - Agent-native application infrastructure. SaaS is a supported output, not the whole category.
3. What should be built first?
   - A create-app package plus one complete booking/business-system template composed from verified modules, followed by managed Cloudflare preview deployment.
4. What must not be built first?
   - A broad marketplace, many templates, heavy dashboard UI, full connector platform, or unrestricted custom-code runtime.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use "production apps/business systems" instead of "SaaS apps" as the main category | Keeps the market broader while still supporting SaaS as one use case. |
| Make managed Cloudflare the default mode | Reduces setup friction and creates recurring platform revenue. |
| Keep admin UI minimal | Users are expected to work through Claude, Codex, Cursor, CLI, and MCP. |
| Start with one vertical template | Proves real usage without diluting engineering effort. |
| Use strict customization levels | Prevents support chaos and preserves upgradeability. |
| Price as agent-native app infrastructure, not Cloudflare hosting | Cloudflare direct pricing is low; our value is modules, managed workflow, safety, and upgrades. |
| Use Free, Builder $49/month, Pro $99/month, Agency $299/month, Enterprise custom as beta pricing hypothesis | Keeps pricing simple and aligned to managed apps/projects. |
| Treat current market research as secondary validation only | No real customer interviews or paid pilot commitments have happened yet. |
| Do not build the full managed runtime before paid-pilot validation | Desk research validates the category, but not purchase intent for the exact product. |
| Publish to MCP directories after MCP readiness gate | MCP directories are high-intent discovery surfaces, but early submission without an installable server would weaken trust. |
| Use a neon green honeycomb module network as the landing page visual system | It supports the module/composition story without turning the product into a cute bee-themed brand. |
| Use TypeScript + Hono/OpenAPIHono on Cloudflare Workers as the runtime baseline | FavCRM proves the pattern locally, and it gives agents inspectable route modules, typed bindings, OpenAPI, middleware composition, and Workers-native deployment. |
| Build create package, project CLI, hosted MCP, and internal TypeScript SDK in the MVP; add local stdio MCP soon after; add Dockerized MCP only after setup friction is proven; defer public SDK | This preserves broad agent compatibility without turning packaging into the product. |
| Stage the MVP as validation shell, agent-to-local app, managed preview deploy, then paid beta | Prevents overbuilding the managed runtime before customer demand and module workflow are proven. |
| Implement the first agent-facing scaffold as local workspace packages and CLI | Proves contracts and generated output before building hosted MCP and managed deploy orchestration. |
| Implement the first hosted MCP surface as a Hono JSON-RPC adapter over the SDK | Proves tool semantics and directory-readiness before adding stateful `McpAgent`, OAuth, or managed deployment. |
| Implement managed preview as a prepared deployment control plane before live provisioning | Gives agents stable deploy/status/log semantics without pretending a real Cloudflare preview exists before the adapter is wired. |
| Implement D1/KV provisioning before Worker upload | Resource planning is easier to validate safely; Worker upload needs a bundling and binding-rewrite adapter to avoid fake preview URLs. |
| Treat provider modules as full service implementations, not simple connectors | A Stripe module must include product/price creation, checkout, payment links, webhook verification, refunds, schema, tests, and events, not just credential storage. |
| Require a standard module package layout and safe `src/index.ts` entrypoint | Agents need predictable files and imports to install, inspect, customize, and upgrade modules safely. |
| Use folder-level barrel exports inside each module | Lets agents import from stable concern folders while leaf files evolve without breaking navigation. |
| Make module docs LLM-accessible | Agents must be able to retrieve module behavior, payloads, responses, permissions, secrets, hooks, and risks without scraping a dashboard. |
| Default source ownership to user-owned repo with branch/PR or patch workflow | Preserves developer trust, inspectability, exportability, and clean production approval gates. |
| Use `microservices-sh` as the MVP managed Workers for Platforms dispatch namespace | Provides a concrete target namespace for generated app Worker deployment planning. |
| Make create package and project CLI the first activation path | Users should see a working local app before configuring MCP, Cloudflare, billing, or hosted tools. |
| Keep MCP as a parity interface over the same SDK | Preserves agent-native distribution while avoiding MCP setup as the first value gate. |
| Start create package distribution with a local workspace scaffold | Lets us validate the flow immediately while leaving npm publish hardening as an explicit next step. |
| Add auth before billing | Stripe checkout and deploy entitlements need reliable user, workspace, owner, session, and CLI API-key identity. |
| Use opaque portal sessions and scoped D1 API keys before JWT-first auth | Browser sessions need revocation and safe cookie storage; CLI/agent access needs stable workspace-scoped keys. Long-lived JWTs are not the right first primitive. |
| Keep static bearer-token auth only as a temporary internal fallback | Existing control-plane tests and internal operations should not break while real workspace auth is introduced. |
| Do not start billing implementation before resolving auth/billing plan review blockers | Workspace tenancy, webhook idempotency, static-key scope, and subscription lifecycle rules are currently not tight enough for safe implementation. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| No `ultracode` skill found in available skills | 1 | Treated it as an operating workflow style rather than a local skill. |
| `git diff --stat` / `git status --short` failed because the directory is not a git repository | 1 | Used `rg --files`, `wc -l`, and content searches for verification instead. |
| Root `pnpm cli -- ...` forwarded a literal `--` into the nested CLI script | 1 | Made the CLI parser ignore the separator and respect `INIT_CWD` for generated output paths. |
| Generated TypeScript initially failed strict typecheck due to JSON fallback inference and narrow audit payload typing | 1 | Updated the generator templates and verified the generated app with `pnpm typecheck`. |
| API Worker initially could not resolve the workspace SDK during typecheck | 1 | Added explicit ESM `import` conditions to the internal package exports. |
| MCP tool response type was too narrow for structured tool-call results | 1 | Added an explicit SDK envelope/result shape and returned `isError: false` for successful calls. |
| CLI API calls to local Wrangler failed under sandboxed Node with `connect EPERM` | 1 | Verified the CLI with approved local-network execution; direct curl and Node fetch also confirmed the API worked. |
| First parallel Vite dev probes for `booking-sveltekit` triggered a Miniflare/workerd `SQLITE_BUSY` startup race | 1 | Retried route/API checks sequentially after startup; homepage, booking form, availability API, booking POST, and admin route passed. |
| Headless Chrome screenshot capture for `booking-sveltekit` hung without producing image files | 1 | Terminated the Chrome screenshot attempts and left browser screenshot verification as a pending task; HTTP and rendered HTML smoke checks passed. |

## Notes
- The plan intentionally puts validation before platform expansion.
- Exact Cloudflare pricing, limits, and API details must be verified again before implementation because platform details change.

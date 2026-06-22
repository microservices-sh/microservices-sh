# Task Plan: microservices.sh MVP Planning

## Goal
Create actionable planning documents that review the microservices.sh concept, define an MVP, and give the team a validation, development, launch, and measurement plan.

## Current Phase
Phase 114

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

### Phase 31: DOT AI OS Template
- [x] Confirm create-app template behavior: users should create with `--template dot-ai-os`, not pass `--framework` or `--modules`.
- [x] Start `templates/dot-ai-os` from the existing Cloudflare SvelteKit product-template skeleton.
- [x] Rebrand manifest, lockfile, package, config, docs, and visible app screens to DOT AI OS.
- [x] Register `dot-ai-os` in the create package repo-template allowlists and build copy lists.
- [x] Validate template spec, create-package build, app build, create-local generation, generated-app check, and create-package tests.
- **Status:** complete

### Phase 32: DOT AI OS Upstream-Informed Revamp
- [x] Inspect `jimmylau-DOTAI/jimmy-dashboard-OS` for product surfaces, route structure, data assumptions, and UI patterns.
- [x] Map useful upstream concepts onto Cloudflare-native microservices.sh modules without importing Vercel/Supabase coupling.
- [x] Revamp `templates/dot-ai-os` routes, content, docs, and checks around the selected operator OS workflows.
- [x] Validate template spec, app build, create-local generation, generated-app check, and relevant package tests.
- **Status:** complete

### Phase 33: DOT AI OS Agentic Operator Work Module
- [x] Define an agent-readable module boundary for tasks, focus blocks, and daily reviews.
- [x] Add module-owned ports, use cases, memory adapter, D1 adapter, schema, and docs.
- [x] Wire `dot-ai-os` task/focus/review pages to module use cases instead of static sample-only data.
- [x] Preserve approval gates for provider writes, AI calls, and external publishing.
- [x] Validate module checks, template checks, app build, generated-app check, and relevant package tests.
- **Status:** complete

### Phase 34: Agentic Admin And Visitor Template Review
- [x] Replace demo-only SaaS starter auth with module-backed identity/email login for admin and owner flows.
- [x] Replace client portal production-disabled login with module-backed identity/email login.
- [x] Scope client portal files to the authenticated customer instead of tenant-wide listing.
- [x] Stabilize the WordPress/EmDash template build under workspace builds.
- [x] Validate targeted template checks, module checks, full specs, tests, and builds where practical.
- **Status:** complete

### Phase 35: DOT AI OS Operator Work Agentic Catalog
- [x] Expose the complete operator-work read/write tool surface in module metadata.
- [x] Preserve approval requirements for task, focus-block, and daily-review writes.
- [x] Add operator-work to the central module contract catalog with permissions, RPC methods, events, hooks, and surfaces.
- [x] Ensure generated SDK module docs include declared agentic tools and approval gates.
- [x] Validate module contract, SDK docs, operator-work spec, and operator-work build.
- **Status:** complete

### Phase 36: Workspace Module Surface Discovery
- [x] Add admin, visitor, and agentic surface declarations to checked-in module manifests.
- [x] Add lightweight reference UI and operator skill docs for every module surface.
- [x] Teach workspace-tools to normalize surfaces, validate local surface files, include surfaces in registry output, and expose them in discovery output.
- [x] Extend tests for surface normalization and checked-in module surface coverage.
- [x] Validate workspace-tools, spec checks, registry build, and discovery output.
- **Status:** complete

### Phase 37: Corporate OS Create-App Onboarding
- [x] Add `--os` / `--corporate-os` mode that defaults create-app to the `dot-ai-os` template.
- [x] Add `--os-intake` and interactive Corporate OS intake prompts for company model, operating loop, workflow, research sources, decisions, and pilot metric.
- [x] Generate `microservices.os.json` plus company model, operating map, research source, decision brief, and pilot plan docs.
- [x] Update create-package README and smoke coverage for Corporate OS generation.
- [x] Validate create-package build, unit tests, and smoke test.
- **Status:** complete

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

### Phase 39: Marketing Skills Validation And Competitor Positioning
- [x] Read available marketing and repo-local product skills.
- [x] Re-check current competitor/category sources.
- [x] Validate production positioning, ICP persona, and product-development priorities.
- [x] Update findings and progress with the revised recommendation.
- **Status:** complete

### Phase 40: Landing Page Content, Marketing Strategy, And Product Roadmap
- [x] Audit landing page and adjacent marketing pages against the `microservices.sh System Harness` positioning.
- [x] Revise landing page, agency page, quickstart, pricing, compare, writing, footer, nav, and landing repo README copy so CLI/MCP are access surfaces rather than the headline.
- [x] Add a current marketing strategy and product roadmap document for developer proof, agency pilots, business-operator pilots, and distribution scale.
- [x] Update planning index, findings, and progress with the revised launch/readiness guidance.
- [x] Validate the landing-page build and whitespace checks.
- **Status:** complete

### Phase 41: Product Roadmap Status Audit
- [x] Check the latest product roadmap one by one against current repository evidence.
- [x] Verify create-package, module, template, registry, shim, and CLI surfaces where practical.
- [x] Fix two small launch-trust issues found during audit: stale booking spec policy and stale create-package help version.
- [x] Identify which roadmap items are done, partial, open, pilot-only, or not verifiable from this repo.
- [x] Add `plans/30-product-roadmap-status-audit.md` as the current execution status source of truth.
- **Status:** complete

### Phase 42: Launch Docs, CLI Boundary, Quickstart Proof, And Pilot Boundary
- [x] Update public docs away from SaaS-boilerplate framing and toward `microservices.sh System Harness`.
- [x] List all current templates and mark `dot-ai-os` as draft/private pilot.
- [x] Make generated project CLI the canonical public CLI path and root CLI internal until catalog sync.
- [x] Keep managed deploy claims to planning/readiness until hosted upload and route activation are verified.
- [x] Keep Agent Center, Hermes, and Ads Manager as private-pilot/demo surfaces; publish Marketing Research only as an approval-gated cited research module.
- [x] Run a clean `booking-sveltekit` quickstart from a packed create-package artifact and record timing/results.
- **Status:** complete

### Phase 43: Marketing Research Module Contract Completion
- [x] Verify `modules/marketing-research` implementation build status.
- [x] Add the standard module docs, OpenAPI, schemas, migration, package exports, and concern-folder entrypoints.
- [x] Preserve approval gates for `marketing-research` provider/runtime actions until workflow proof exists.
- [x] Verify `pnpm --filter @microservices-sh/marketing-research build`.
- [x] Verify `pnpm --filter @microservices-sh/marketing-research check:spec`.
- **Status:** complete

### Phase 44: Marketing Research Publish-Ready Metadata
- [x] Mark `marketing-research` as an available catalog module.
- [x] Add reference UI metadata and an agent operator skill.
- [x] Update roadmap/operator docs so Marketing Research is publishable as governed cited research, while external provider actions stay approval-gated.
- [x] Verify `pnpm spec:check:all`.
- [x] Verify generated registry lists `marketing-research` as `available` with skill and approval metadata.
- **Status:** complete

### Phase 45: StackSuite Commerce And Accounting Template Split
- [x] Add StackSuite-derived modules for commerce, accounting, AP, AR, bank reconciliation, and commerce sync.
- [x] Add `commerce-ops-sveltekit` and `accounting-erp-sveltekit` repo-style templates derived from `erp-shell-sveltekit`.
- [x] Register the new templates in create-app template discovery and bundling metadata.
- [x] Add route-level pages and sidebar entries for StackSuite commerce modules: products, inventory, sales orders, shipments, and commerce sync.
- [x] Add route-level pages and sidebar entries for StackSuite accounting modules: ledger, payables, receivables, and banking.
- [ ] Prune inherited broad ERP shell deps and migrations once shared dashboard/store imports are narrowed.
- **Status:** route-level template adoption complete; dependency pruning pending

### Phase 46: StackSuite Route Adoption Fixes
- [x] Verify focused template route builds and generated route smoke checks.
- [x] Fix commerce inventory demo stock visibility by aligning the inventory page with the seeded `default` stock location.
- **Status:** complete

### Phase 47: StackSuite Durable Adapter Readiness
- [x] Add async store-backed service factories while preserving synchronous memory services for `accounts-receivable`, `bank-reconciliation`, and `commerce-sync`.
- [x] Add memory store adapters and tests for store-backed accounts receivable, bank reconciliation, and commerce sync flows.
- [x] Add a D1 bank reconciliation store mapped to the existing module migration tables.
- [x] Document the temporary D1 blockers for accounts receivable and commerce sync where module-owned durable tables were not yet present.
- [x] Verify focused module tests/build/spec checks plus full workspace spec validation.
- [x] Add accounts receivable D1 after an invoice snapshot table contract is added or verified. Completed in Phase 49.
- [x] Add commerce sync D1 after a normalized envelope table contract is added or verified. Completed in Phase 49.
- **Status:** durable service ports complete; D1 adapters complete for bank, accounts receivable, and commerce sync

### Phase 48: Focused Template Durable Service Wiring
- [x] Wire `accounting-erp-sveltekit` receivables to the store-backed accounts receivable service.
- [x] Wire `accounting-erp-sveltekit` banking to the store-backed bank reconciliation service, using D1 when the template DB binding exists.
- [x] Wire `commerce-ops-sveltekit` commerce sync to the store-backed commerce sync service.
- [x] Preserve memory-backed fallbacks for local development while D1 adapters landed in Phase 49.
- [x] Verify both focused template specs, both focused template builds, create-app bundle build, bundle closure, full workspace spec, and whitespace checks.
- **Status:** complete

### Phase 49: Accounts Receivable And Commerce Sync D1 Completion
- [x] Add `ar_invoice_snapshots` and `createD1AccountsReceivableStore(db)` so receivables can run fully on D1.
- [x] Add `commerce_sync_envelopes` and `createD1CommerceSyncStore(db)` so commerce sync can persist normalized envelopes on D1.
- [x] Export D1 adapters from package roots and package subpaths.
- [x] Wire focused accounting and commerce templates to use the new D1 stores when a DB binding exists.
- [x] Move commerce sync demo data into local demo seeding so the commerce sync page reads persisted service state.
- [x] Verify focused module tests/build/specs, migrations, focused template specs/builds, create-app build, bundle closure, full workspace spec, and whitespace checks.
- **Status:** complete

### Phase 50: Accounts Receivable Route Write Workflow
- [x] Add a manager-gated `/app/receivables` payment action that records and applies customer payments through the accounts-receivable service.
- [x] Add per-invoice receivables payment forms with amount/date inputs and feedback.
- [x] Guard demo receivable seeding so local payments persist across reloads.
- [x] Verify accounting template build/spec, accounts-receivable build/test/spec, create-app build, bundle closure, create-app tests, and whitespace checks.
- **Status:** complete

### Phase 51: Broader StackSuite App Adoption Audit
- [x] Review remaining StackSuite apps beyond accounting and commerce by schema/docs evidence.
- [x] Rank reusable module/template candidates and avoid full-app cloning.
- [x] Add `plans/35-stacksuite-broader-adoption-plan.md`.
- [x] Link the plan from `plans/README.md`, `findings.md`, and `progress.md`.
- **Status:** complete

### Phase 52: StackSuite SMS Campaigns Module
- [x] Scaffold `modules/sms-campaigns` from the standard module layout.
- [x] Implement tenant-scoped contacts, groups, templates, provider configs, campaigns, recipients, and delivery logs.
- [x] Add memory and D1 stores, provider port, module schemas, resources, permissions, events, migration, and exports.
- [x] Add tests for opt-in filtering, scheduled due selection, dispatch, idempotent delivery callbacks, and no-opt-in rejection.
- [x] Verify build, tests, module spec, migration smoke, and whitespace checks for the module slice.
- **Status:** complete

### Phase 53: StackSuite Support Inbox Module
- [x] Avoid concurrent `support-ticket` and `knowledge-base-rag` edits by splitting HelpGrid widget/conversation behavior into `support-inbox`.
- [x] Implement project-scoped widget settings, quick actions, conversations, messages, channel connection metadata, and agent takeover state.
- [x] Add memory and D1 stores, migration, schemas, module metadata, OpenAPI/docs, permissions, events, resources, and exports.
- [x] Add tests for widget config, sorted quick actions, conversation reuse, message threads, agent takeover guard, and WhatsApp channel secret refs.
- [x] Verify build, tests, module spec, migration smoke, JSON parsing, and whitespace checks for the module slice.
- **Status:** complete

### Phase 54: StackSuite Membership Credits Module
- [x] Inspect booking-system membership/credits schema and workflows.
- [x] Scaffold `modules/membership-credits` from the standard module layout.
- [x] Implement membership tiers, active customer memberships, customer credit balances, credit transactions, and membership history.
- [x] Store money as integer cents, not floating-point values.
- [x] Add memory and D1 stores, migration, schemas, docs, module metadata, permissions, events, resources, exports, and tests.
- [x] Verify build, tests, module spec, migration smoke, JSON parsing, and whitespace checks for the module slice.
- **Status:** complete

### Phase 55: StackSuite Estimate Quote Module
- [x] Inspect accounting-system estimate schema, route actions, and conversion workflow.
- [x] Scaffold `modules/estimate-quote` from the standard module layout.
- [x] Implement quote numbering, draft edits, cents-based totals, send/view/accept/decline/expire/void transitions, and invoice conversion handoff.
- [x] Add memory and D1 stores, migration, schemas, docs, module metadata, permissions, events, resources, exports, and tests.
- [x] Verify build, tests, module spec, migration smoke, JSON parsing, and whitespace checks for the module slice.
- **Status:** complete

### Phase 56: StackSuite Recurring Documents Module
- [x] Inspect accounting-system recurring invoice and recurring bill schemas, routes, and generation workflows.
- [x] Scaffold `modules/recurring-documents` from the standard module layout.
- [x] Implement recurring invoice/bill templates, schedule state, active/paused/completed/cancelled lifecycle, due generation, and draft payload handoff.
- [x] Add memory and D1 stores, migration, schemas, docs, module metadata, permissions, events, resources, exports, and tests.
- [x] Verify build, tests, module spec, migration smoke, JSON parsing, and whitespace checks for the module slice.
- **Status:** complete

### Phase 57: StackSuite Storage Entitlements Module
- [x] Inspect DashDrive storage quota, package, purchase, share-link, expiry, and download-count workflows.
- [x] Scaffold `modules/storage-entitlements` from the standard module layout.
- [x] Implement owner-scoped storage accounts, quota accounting, storage packages, idempotent purchase completion, expiring share links, download counts, and revocation.
- [x] Add memory and D1 stores, migration, schemas, docs, module metadata, permissions, events, resources, exports, and tests.
- [x] Verify build, tests, module spec, migration smoke, JSON parsing, and whitespace checks for the module slice.
- **Status:** complete

### Phase 58: StackSuite HR People Ops Module
- [x] Inspect HR System employee, department, position, leave, and attendance schema.
- [x] Scaffold `modules/hr-people-ops` from the standard module layout.
- [x] Implement employee directory, department/position hierarchy, leave type/balance setup, leave request approval/rejection/cancellation, and attendance upsert workflows.
- [x] Store leave balances as integer hundredths of a day instead of floating-point day totals.
- [x] Add memory and D1 stores, migration, schemas, docs, module metadata, permissions, events, resources, exports, and tests.
- [x] Verify build, tests, module spec, migration smoke, JSON parsing, and whitespace checks for the module slice.
- **Status:** complete

### Phase 59: StackSuite URL Shortener Module
- [x] Inspect URL Shortener D1 schema, shorten route, redirect route, and stats route.
- [x] Scaffold `modules/url-shortener` from the standard module layout.
- [x] Implement short-link creation, URL validation, reserved/custom aliases, expiry, deactivation, redirect resolution, click analytics, stats, and recent-link listing.
- [x] Add memory and D1 stores, migration, schemas, docs, module metadata, permissions, events, resources, exports, and tests.
- [x] Keep KV redirect caching as an app-adapter concern rather than module-owned state.
- [x] Verify build, tests, module spec, migration smoke, JSON parsing, and whitespace checks for the module slice.
- **Status:** complete

### Phase 60: StackSuite HTML Renderer Module
- [x] Inspect HTML Renderer upload, slug validation, TTL, asset, serve, and delete workflow.
- [x] Treat QR Generator as a browser-only reference/free-tool candidate rather than a durable module.
- [x] Scaffold `modules/html-renderer` from the standard module layout.
- [x] Implement HTML render document creation, slug validation, TTL expiry, asset metadata validation, resolve, soft delete, and listing.
- [x] Add memory and D1 stores, migration, schemas, docs, module metadata, permissions, events, resources, exports, and tests.
- [x] Keep public route auth, KV/R2 object storage, and large binary upload as app-adapter concerns.
- [x] Verify build, tests, module spec, migration smoke, JSON parsing, and whitespace checks for the module slice.
- **Status:** complete

### Phase 61: StackSuite Content CMS Module
- [x] Inspect CMS content type, field, entry version, localization, media, and locale schemas.
- [x] Scaffold `modules/content-cms` from the standard module layout.
- [x] Implement headless content types, fields, versioned entries, publish/archive lifecycle, localizations, locales, media metadata, and entry snapshots.
- [x] Add memory and D1 stores, migration, schemas, docs, module metadata, permissions, events, resources, exports, and tests.
- [x] Keep auth, billing, API keys, setup wizard, AI page designer, R2 uploads, CDN policy, and public rendering as template/app-adapter concerns.
- [x] Verify build, tests, module spec, migration smoke, JSON parsing, and whitespace checks for the module slice.
- **Status:** complete

### Phase 62: StackSuite Video Generation Module
- [x] Inspect `veo-video-maker` and delegated donor review of `gpt-hk` video generation workflows.
- [x] Confirm `markdown-to-pdf` is browser/free-tool material and defer `document-renderer` until shared server-side PDF jobs are needed.
- [x] Scaffold `modules/video-generation` from the standard module layout.
- [x] Implement provider-neutral video jobs, provider task ids, status reconciliation, idempotent provider URL outputs, manual output attachment, cancellation, listing, and snapshots.
- [x] Add memory and D1 stores, migration, schemas, docs, module metadata, permissions, events, resources, exports, and tests.
- [x] Keep provider credentials, billing/credits, auth, rate limits, moderation, R2 byte downloads, signed URLs, webhooks, browser FFmpeg, and story UI as route-adapter/template concerns.
- [x] Verify build, tests, module spec, migration smoke, JSON parsing, and whitespace checks for the module slice.
- **Status:** complete

### Phase 63: StackSuite Project Progress Module
- [x] Inspect EPMIS project/customer progress, worker access, progress logs, media, comments, and public access-token workflows.
- [x] Scaffold `modules/project-progress` from the standard module layout.
- [x] Implement tenant-scoped projects, worker access grants, progress logs, media metadata, comments, public snapshots, memory store, D1 store, migration, schemas, docs, metadata, permissions, events, resources, exports, and tests.
- [x] Keep auth/users/customers, QR image generation, byte uploads, R2 signing, email logs, and UI outside the module boundary.
- [x] Verify build, tests, module spec, migration smoke, JSON parsing, and whitespace checks for the module slice.
- **Status:** complete

### Phase 64: HelpGrid Support Ticket Hardening
- [x] Inspect HelpGrid ticket sequences, comments, attachments, and share-token workflows.
- [x] Extend `support-ticket` with per-tenant ticket numbers, comments, attachment metadata, public follow-up share tokens, thread listing, and public token resolution.
- [x] Add memory/D1 store methods, migration tables, schemas, module metadata, OpenAPI/docs, events, exports, scoped wrappers, and tests.
- [x] Keep pending upload sessions, raw R2 uploads, signed URLs, AI analyses/follow-up questions, billing tokens, WhatsApp, and UI outside the module boundary.
- [x] Verify build, tests, module spec, migration smoke, JSON parsing, registry build, and whitespace checks for the module slice.
- **Status:** complete

### Phase 65: StackSuite Accounting And Commerce Parity Hardening
- [x] Port commerce document export helpers, packing-slip print helpers, and invoice-send/payment-link workflows into `commerce-ops-sveltekit`.
- [x] Add scheduled runtime glue and guarded HTTP cron fallbacks for both focused StackSuite templates.
- [x] Align commerce reservation side effects across sales-order confirmation, cancellation, invoice handoff, shipment completion, combo components, and MCP lifecycle tools.
- [x] Map WooCommerce signed order webhooks and normalized order envelopes through the sales-order, customer, product, inventory, and provider-mapping lifecycle.
- [x] Add accounting reports for AR aging, AP aging, open receivables, and customer statements.
- [x] Add accounting invoice collection with payment-link creation, email send, signed Stripe webhook settlement, and AR snapshot refresh.
- [x] Post manually issued invoices and customer-payment settlement into `accounting-core` journals through request-scoped accounting adapters.
- [x] Verify focused module tests/builds, focused template checks/builds, full workspace spec checks, create-app build, create-app smoke, and whitespace checks across the committed slices.
- **Status:** complete

### Phase 66: Recurring Invoice Accounting Job Parity
- [x] Wire recurring invoice generate-due jobs to post auto-issued generated invoices into `accounting-core`.
- [x] Sync generated auto-issued recurring invoices into Accounts Receivable snapshots.
- [x] Pass accounting and receivables stores through both Cloudflare scheduled runtime and operator-run due jobs.
- [x] Add a focused integration regression for auto-issued recurring invoice GL posting and AR sync.
- [x] Verify focused scheduled-runtime test, accounting template check, accounting template build, and whitespace checks.
- **Status:** complete

### Phase 67: Accounting Ledger Tenant Scoping Fix
- [x] Fix `/app/ledger` account creation to use the resolved company context (`ctx.org.id`) instead of an out-of-scope `org`.
- [x] Extend accounting template assertions so ledger account creation remains active-org scoped.
- [x] Verify accounting template check, accounting template build, and whitespace checks.
- **Status:** complete

### Phase 68: Commerce Stale Billing Hook Cleanup
- [x] Remove stale `billingStore` locals wiring from the commerce template request hook.
- [x] Add a commerce template assertion that the removed billing store surface is not wired in `hooks.server.ts`.
- [x] Verify commerce template check, commerce template build, and whitespace checks.
- **Status:** complete

### Phase 69: StackSuite Public Plan Refresh
- [x] Refresh `docs/templates/stacksuite-porting-plan.md` so the public plan matches the committed accounting/commerce parity baseline.
- [x] Add explicit Code Memory donor-scan guidance for the two StackSuite source projects.
- [x] Verify documentation diff, stale wording scan, and whitespace checks.
- **Status:** complete

### Phase 70: Commerce Generated-App Packaging Fix
- [x] Vendor `sdk-internal` and `module-contract` into generated apps that depend on StackSuite MCP/generation helpers.
- [x] Rewrite copied support-package runtime dependencies so generated apps do not retain `workspace:*` links.
- [x] Pass `readText` into generated SvelteKit contract checks so template policies behave the same in source and generated apps.
- [x] Add built-smoke coverage that rejects generated runtime `workspace:*` dependencies.
- [x] Verify create-app build/test/smoke, shim sync, full spec checks, generated commerce install, generated commerce check, and whitespace checks.
- **Status:** complete

### Phase 71: Focused Template Email Lock Alignment
- [x] Add the `email` module contract to `commerce-ops-sveltekit` and `accounting-erp-sveltekit` lockfiles.
- [x] Add template assertions that email-backed login/invoice-send workflows remain represented in the locks.
- [x] Verify focused template checks, create-app build/smoke, full workspace specs, and whitespace checks.
- **Status:** complete

### Phase 72: Commerce Sync Migration Ownership Cleanup
- [x] Remove the stale `domain_events` table declaration from `commerce-ops-sveltekit` commerce-sync migration; `0001_core.sql` owns the shared event stream.
- [x] Add a commerce template policy assertion preventing the commerce-sync migration from redeclaring `domain_events`.
- [x] Verify focused template check, SQLite migration load, full workspace specs, commerce template build, and whitespace checks.
- **Status:** complete

### Phase 73: Commerce MCP Lock-Authoritative Catalog
- [x] Make `commerce-ops-sveltekit` MCP generation use the template lockfile RPC snapshot instead of merging module `connections` from workspace/package layouts.
- [x] Remove commerce MCP handlers for tools absent from the lock snapshot (`payment_createPaymentIntent`, `org-team-rbac_authorize`).
- [x] Derive the Agent Center visible tool list from lock-declared RPC methods so it stops advertising hand-written non-MCP tools.
- [x] Add template and integration-test guards for lock-authoritative generation, 50 commerce tools, and absence of unlocked handlers.
- [x] Verify focused generation, MCP wiring tests, template checks, packaged-template checks, commerce build, create-app build/smoke, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 74: Accounting Domain Event Schema Alignment
- [x] Update accounting-core and accounts-payable D1 event writers to use the core-owned `domain_events` schema (`event_name`, `entity_type`, `entity_id`).
- [x] Standardize accounting-core, accounts-payable, accounts-receivable, and bank-reconciliation standalone migrations on the shared domain-event schema.
- [x] Remove duplicate `domain_events` declarations from the focused accounting template AP, AR, and bank migrations.
- [x] Add accounting template assertions that `0001_core.sql` owns `domain_events` and later accounting migrations do not redeclare it.
- [x] Verify focused template checks, module builds/tests, SQLite migration smokes, full workspace specs, accounting build, create-app build/smoke, packaged-template checks, drift scans, and whitespace checks.
- **Status:** complete

### Phase 75: StackSuite Docs Catalog Metadata Sync
- [x] Sync the simplified docs module catalog for StackSuite commerce/accounting modules with generated registry metadata from module manifests.
- [x] Keep StackSuite modules `draft` while generated-project smoke and promotion criteria remain pending.
- [x] Mark `email` `available` in the docs catalog to match its module manifest and focused-template lock usage.
- [x] Verify catalog JSON, selected field drift against the generated registry, full workspace specs, and whitespace checks.
- **Status:** complete

### Phase 76: Commerce Domain Event Schema Alignment
- [x] Update product-catalog, sales-order, and shipment D1 event writers to use the shared `domain_events` schema (`event_name`, `entity_type`, `entity_id`).
- [x] Standardize product-catalog, sales-order, shipment, and commerce-sync standalone migrations on the shared domain-event schema.
- [x] Add commerce template assertions that focused product, sales-order, shipment, and commerce-sync migrations do not redeclare the core-owned table, and packaged module migrations use the shared schema.
- [x] Verify module checks/builds/tests, SQLite migration smokes, commerce template checks/build/smoke, packaged template checks, full workspace specs, drift scans, and whitespace checks.
- **Status:** complete

### Phase 77: Generated StackSuite Install/Build Smoke
- [x] Add an opt-in deep create-app smoke gate that installs, builds, and checks generated accounting and commerce apps.
- [x] Link copied support packages from generated repo-template app roots so linked modules resolve local package dependencies.
- [x] Make SvelteKit template config and focused accounting/commerce route scripts robust under fresh generated-app dependency installs.
- [x] Verify focused template builds, create-app build/tests, generated accounting/commerce install-build smoke, full workspace specs, shim sync, and whitespace checks.
- **Status:** complete

### Phase 78: StackSuite Public Docs Catalog Closure
- [x] Add public catalog rows and Markdown references for `estimate-quote` and `recurring-documents`.
- [x] Refresh the module docs index and LLM guide so StackSuite accounting/commerce docs are discoverable.
- [x] Correct stale commerce-sync and email secret/status wording.
- [x] Update StackSuite planning docs so quote/recurring route proof is complete and remaining work is catalog/promotion guardrail work.
- [x] Verify catalog JSON, docs presence, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 79: Internal StackSuite Catalog Closure
- [x] Add StackSuite commerce/accounting modules, quote/recurring modules, invoice dependency support, and current email metadata to the internal module-contract catalog.
- [x] Remove stale planned email docs from the SDK fallback path so generated app docs derive email from the current contract metadata.
- [x] Add module-contract and SDK tests for StackSuite visibility, dependency resolution, duplicate-free email docs, and current email secrets.
- [x] Verify package builds, focused catalog tests, internal catalog sanity, workspace specs, create-app build/test, and whitespace checks.
- **Status:** complete

### Phase 80: Focused StackSuite Catalog Drift Guard
- [x] Add template checks that fail when locked StackSuite modules are missing from `docs/modules/catalog.json`.
- [x] Add template checks that fail when locked StackSuite modules are missing from the internal `module-contract` catalog.
- [x] Scope the first guard to StackSuite commerce/accounting, quote/recurring, and email rows while broader historical module docs are completed separately.
- [x] Verify workspace-tools build, focused accounting/commerce template checks, full workspace specs, and whitespace checks.
- **Status:** complete

### Phase 81: Estimate Quote Surface Path Alignment
- [x] Align the estimate-quote canonical admin nav and docs/internal catalog mount to `/quotes`.
- [x] Keep the accounting template lock and generated template copy consistent with the `/app/quotes` route adapter.
- [x] Update module-contract expectations for the canonical quote runtime mount.
- [x] Verify module spec, internal catalog tests, workspace specs, create-app build/test, and whitespace checks.
- **Status:** complete

### Phase 82: Commerce Inventory Adjust And Reconcile Route Proof
- [x] Add commerce inventory operator actions for manual stock adjustment and physical count reconciliation.
- [x] Render recent count/adjustment movements alongside the movement ledger.
- [x] Add focused commerce template policy checks for the inventory receive/adjust/reconcile route proof.
- [x] Refresh StackSuite planning docs so route-level inventory adjust/reconcile is no longer marked pending.
- [x] Verify commerce template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 83: Accounting AP Recurring Bill Route Proof
- [x] Add recurring bill schedule list/create/status/update and due-generation actions to the Payables route.
- [x] Keep due generation as draft bill creation so the existing bill post/pay workflow remains the accounting approval gate.
- [x] Add focused accounting template policy checks for AP recurring bill route proof.
- [x] Refresh StackSuite planning docs so AP recurring bill route proof is no longer marked pending.
- [x] Verify accounting template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 84: Locked Foundation Module Catalog Closure
- [x] Add public docs catalog rows and reference pages for `org-team-rbac`, `admin-shell`, `file-media`, `jobs-workflows`, `notifications-inapp`, and `support-ticket`.
- [x] Add internal `module-contract` catalog rows so `inspectModule("<id>@0.1.0")` and generated SDK docs cover those locked foundation modules.
- [x] Broaden the template catalog drift guard from StackSuite-only rows to guarded locked modules used by SaaS, portal, commerce, accounting, and ERP templates.
- [x] Add module-contract and SDK tests for foundation module visibility, mounts, approval risk, RPC, events, generated docs, and source doc paths.
- [x] Verify package builds, focused template JSON checks, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 85: Full Locked Module Catalog Closure
- [x] Add public docs catalog rows and reference pages for every remaining module locked by current templates.
- [x] Add internal module-contract rows for locked modules missing from `inspectModule("<id>@0.1.0")`.
- [x] Broaden the locked-module guard so every template lock entry must exist in the public docs catalog, point to an existing Markdown file, and exist in the internal module-contract catalog.
- [x] Sync remaining module docs, manifests, and internal catalog metadata for risk, secrets, dependencies, hooks, public RPCs, and mounts.
- [x] Add module-contract and SDK tests for the complete 39-module locked set and representative generated-doc metadata.
- [x] Verify catalog JSON, duplicate-free catalogs, focused tests, package builds, representative template checks, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 86: Commerce Shipment Detail Route Proof
- [x] Add shared shipment print-document context for list and detail routes.
- [x] Add `/app/shipments/[id]` backed by `getShipment`, related sales-order lookup, print actions, activity, and guarded completion.
- [x] Link the shipment list to the detail route.
- [x] Add commerce template policy checks for the shared helper, list link, and detail route.
- [x] Verify commerce template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 87: Commerce Sync Logs Route Proof
- [x] Add read-only `/app/commerce-sync/logs` backed by commerce-sync list APIs for runs, webhook receipts, mappings, and sanitized connections.
- [x] Link the Commerce sync page to the logs route.
- [x] Add template policy checks for tenant-scoped list calls and redaction of secret, credential, signature, and raw body fields.
- [x] Add commerce-sync module tests for tenant-scoped, ordered list results.
- [x] Verify commerce-sync tests, commerce template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 88: Commerce Sales Order Detail Route Proof
- [x] Add read-only `/app/sales-orders/[id]` backed by `getOrder`, print, CSV, and order summary data.
- [x] Link the sales-order ledger and shipment detail page to the sales-order detail route.
- [x] Add commerce template policy checks for detail load, read-only side-effect boundary, print, and CSV.
- [x] Verify commerce template spec/build, sales-order tests, commerce integration tests, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 89: Accounting AP Recurring Bill Detail Route Proof
- [x] Add `getRecurringBillTemplate` as a public accounts-payable use case over the existing tenant-scoped store method.
- [x] Add read-only `/app/payables/recurring/[id]` backed by `getRecurringBillTemplate`, schedule summary, totals, and line items.
- [x] Link the Payables recurring schedule table to the detail route.
- [x] Add accounting template policy checks for detail load and read-only side-effect boundary.
- [x] Verify accounts-payable tests, accounting template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 90: Accounting Banking Import Detail Route Proof
- [x] Add read-only `/app/banking/imports/[id]` over tenant-scoped bank-reconciliation import and transaction list APIs.
- [x] Link the Banking import history table to the import detail route.
- [x] Add accounting template policy checks for tenant scoping and read-only side-effect boundary.
- [x] Verify bank-reconciliation tests, accounting template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 91: Accounting Banking Reconciliation Detail Route Proof
- [x] Add read-only `/app/banking/reconciliations/[id]` over account-scoped reconciliation, transaction, and import list APIs.
- [x] Link the Banking reconciliation session list to the reconciliation detail route.
- [x] Add accounting template policy checks for tenant/account/session filtering and read-only side-effect boundary.
- [x] Verify bank-reconciliation tests, accounting template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 92: Accounting Ledger Account Detail Route Proof
- [x] Add `getAccount` as a public accounting-core use case over the existing tenant-scoped store method.
- [x] Add read-only `/app/ledger/accounts/[id]` backed by `getAccount`, child account context, and trial-balance totals.
- [x] Link the Ledger chart and trial-balance rows to the account detail route.
- [x] Add accounting template policy checks for read-only account detail boundary.
- [x] Verify accounting-core tests, accounting template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 93: Accounting Fiscal Period Detail Route Proof
- [x] Add `getFiscalPeriod` and `listFiscalPeriods` as public accounting-core read use cases over existing tenant-scoped store methods.
- [x] Refactor `/app/ledger` fiscal-period loading to use `listFiscalPeriods` instead of direct store access.
- [x] Add read-only `/app/ledger/fiscal-periods/[id]` backed by `getFiscalPeriod`, adjacent-period context, and period trial-balance totals.
- [x] Link the Ledger fiscal-period rows to the period detail route.
- [x] Add module and template policy checks for fiscal-period read use cases and read-only detail boundary.
- [x] Verify accounting-core tests/spec/build, accounting template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 94: Accounting Fiscal Period Lifecycle Hardening
- [x] Add explicit `closeFiscalPeriod`, `reopenFiscalPeriod`, and `lockFiscalPeriod` accounting-core use cases.
- [x] Make `updateFiscalPeriodStatus` enforce source-style transition rules while remaining a compatibility wrapper.
- [x] Cover valid and invalid open/closed/locked transition matrices with accounting-core tests.
- [x] Replace the Ledger fiscal-period status dropdown with explicit close, reopen, and lock actions.
- [x] Make Ledger manual fiscal-period creation default to open so template UI cannot bypass lifecycle actions.
- [x] Update module docs, manifests, OpenAPI, LLM notes, and policy checks for lifecycle invariants.
- [x] Verify accounting-core tests/spec/build, accounting template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 95: Accounting Fiscal Period Metadata Parity
- [x] Add source-parity fiscal period `periodType` and `closedById` fields to accounting-core types, schemas, adapters, and migrations.
- [x] Add module and template D1 upgrade migrations for existing generated apps.
- [x] Preserve `closedById` during lock, set it during close, and clear it during reopen.
- [x] Expose period type and close actor metadata in Ledger period list/detail UI.
- [x] Add period-type filtering tests and policy checks for metadata migrations/docs/UI.
- [x] Verify accounting-core tests/spec/build, accounting template spec/build, create-app build/test, workspace specs, migration replay, and whitespace checks.
- **Status:** complete

### Phase 96: Accounting Setup Standard And Base Currency Parity
- [x] Add GAAP/IFRS chart seed standard support to accounting-core setup schemas, types, OpenAPI, JSON schema, and docs.
- [x] Add an IFRS chart variant that preserves source operational flags while applying intended non-current asset terminology.
- [x] Report configured base currency from accounting setup status.
- [x] Expose chart standard and base currency controls on the accounting settings route.
- [x] Add module and template policy checks for setup standard/currency parity.
- [x] Verify accounting-core tests/spec/build, accounting template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 97: Accounting Fiscal Period Transition CAS Hardening
- [x] Add a store-level `updateFiscalPeriodIfCurrentStatus` compare-and-set contract.
- [x] Implement status-guarded fiscal-period updates in memory and D1 adapters.
- [x] Return `accounting-core.FISCAL_PERIOD_TRANSITION_CONFLICT` without writing an event when close/reopen/lock loses a race.
- [x] Add use-case and D1 adapter tests for stale status and tenant mismatch failures.
- [x] Update module docs and policy checks for fiscal-period compare-and-set lifecycle writes.
- [x] Verify accounting-core tests/spec/build, accounting template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 98: Accounting General Ledger Report Contract
- [x] Add source-style account-scoped general ledger filters, types, schema, and use case.
- [x] Add memory and D1 general ledger posting reads over posted/void journal lines.
- [x] Add module metadata, OpenAPI, docs, and policy checks for `getGeneralLedger`.
- [x] Expose general ledger account/date selection on accounting template reports.
- [x] Verify accounting-core tests/spec/build, accounting template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 99: Accounting Setup Default Account Persistence
- [x] Add tenant-scoped accounting setup settings and D1/template migrations.
- [x] Auto-map seeded GAAP/IFRS AR/AP/income account codes into persisted settings.
- [x] Add `updateAccountingSettings` validation for same-tenant active non-header default accounts with compatible account types.
- [x] Expose default AR/AP/income account selectors on the accounting settings template page.
- [x] Verify accounting-core tests/spec/build, accounting template spec/build, migration replay, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 100: Accounting Posting Bridges Consume Setup Defaults
- [x] Make AR invoice and payment posting resolve persisted accounting AR/income defaults before legacy code fallback.
- [x] Fail configured tenants that have a settings row but missing AR/income defaults instead of silently falling back to hard-coded codes.
- [x] Make AP bill creation and payable posting resolve persisted AP defaults server-side while preserving bill-level AP posting contracts.
- [x] Add template policy checks for persisted AR/income/AP default consumption.
- [x] Verify accounting template spec/build, accounting-core/AP/AR tests, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 101: Accounting Deposit Account Defaults
- [x] Add accounting-core settings fields for a general payment deposit account and source-compatible Stripe deposit override.
- [x] Add module/template D1 upgrade migrations for deposit-account settings.
- [x] Auto-map seeded chart code `1120` into the general payment deposit default.
- [x] Expose payment deposit and Stripe deposit selectors on the accounting settings route.
- [x] Make AR payment posting consume the persisted deposit default and make Stripe webhooks pass the Stripe override when configured.
- [x] Verify accounting-core tests/spec/build, accounting template spec/build, migration replay, AR tests, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 102: AP Vendor Default Expense Account Parity
- [x] Confirm StackSuite donor behavior for vendor default expense accounts and bill-form defaulting.
- [x] Make accounts-payable bill and recurring bill creation fill blank line expense accounts from the selected vendor default.
- [x] Expose and validate vendor default expense account selection in the focused accounting Payables template.
- [x] Add module/template policy checks for vendor default expense account persistence and fallback behavior.
- [x] Verify AP tests/spec/build, accounting template spec/build, accounting template build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 103: AP Bill Detail Route Proof
- [x] Add a tenant-scoped `getBill` use case over the existing accounts-payable store method.
- [x] Add a focused accounting Payables bill detail route with vendor, line item, totals, lifecycle, and memo views.
- [x] Link the Payables bill ledger to the detail route while keeping mark-payable/payment side effects on the existing Payables action surface.
- [x] Add module/template policy checks for the read use case and route boundary.
- [x] Verify AP tests/spec/build, accounting template spec/build/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 104: AP Payment Workbench
- [x] Add accounts-payable module coverage for one payment applied across multiple bills with partial amounts.
- [x] Extend the focused accounting Payables payment action to accept multiple bill applications and method/reference/memo fields.
- [x] Add a server-rendered AP payment workbench over open bills while preserving the existing one-click full-bill payment action.
- [x] Add template policy checks for multi-application payment workflow.
- [x] Verify AP tests/spec/build, accounting template spec/build/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 105: AP Payment Read And Bill History
- [x] Add `getBillPayment` and `listBillPayments` read use cases with memory/D1 store parity.
- [x] Add payment filters for tenant, vendor, bill, status, and limit.
- [x] Add tests for tenant-scoped payment detail and bill-filtered payment history.
- [x] Add AP payment history to the focused accounting bill detail route.
- [x] Verify AP tests/spec/build, accounting template spec/build/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 106: AP Vendor Detail And 1099 Readiness
- [x] Add tenant-scoped `getVendor` read use case and module metadata.
- [x] Add AP tests for vendor detail tenant isolation.
- [x] Add focused accounting vendor directory links and a read-only vendor detail route with bills, recurring bills, payment history, aging, and 1099 readiness context.
- [x] Keep vendor mutations on the Payables operator route; do not add vendor update/deactivation forms in this slice.
- [x] Verify AP tests/spec/build, accounting template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 107: AP Vendor Master Completion And Formal 1099 Report
- [x] Add `updateVendor`, vendor active-state mutation, and a formal `get1099VendorReport({ tenantId, year })` module use case.
- [x] Add memory/D1 store support and AP tests for tenant isolation, inactive handling, year boundaries, and void-payment exclusion.
- [x] Expand the accounting template vendor forms to capture phone, address, tax ID, 1099 flag, default terms, notes, and active state.
- [x] Add an accounting template 1099 report/readiness surface without implying IRS filing or TIN validation.
- [x] Verify AP tests/spec/build, accounting template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 108: AP Payment Detail Route
- [x] Add focused accounting read-only AP payment detail route backed by `getBillPayment`.
- [x] Link bill and vendor payment history rows to the payment detail route.
- [x] Show vendor, payment account, method/reference, journal, applications, and lifecycle context without void/reversal actions.
- [x] Add accounting template policy checks for the read-only payment detail boundary.
- [x] Verify AP tests/spec/build, accounting template spec/build, create-app build/test, workspace specs, and whitespace checks.
- **Status:** complete

### Phase 109: AP Approval And Posting Split
- [x] Add a module-level `postBillToAccounting` use case for approved unpaid bills.
- [x] Keep accounting-backed AP payments blocked until the bill is posted.
- [x] Make the accounting template AP poster reuse posted source-ref journals on retries.
- [x] Split the focused Payables operator flow into approve, post, and pay states.
- [x] Sync AP module docs, events, catalog metadata, and template locks with the new post boundary.
- [x] Verify AP tests/spec/build, accounting template spec/build, create-app build/test, workspace specs, catalog tests, and whitespace checks.
- **Status:** complete

### Phase 110: AP Unpaid Bill Void
- [x] Add module-level `voidBill` for unpaid bills that have not been posted to accounting.
- [x] Add void hooks, `accounts-payable.bill_voided`, catalog metadata, module contract entries, template locks, docs, OpenAPI, and schema exports.
- [x] Cover idempotent void replay plus rejection after payment or accounting posting.
- [x] Add a guarded bill-detail action/form for unpaid unposted voids while keeping post and payment workflows on the Payables operator page.
- [x] Verify AP tests/spec/build and accounting template spec/build before workspace checks.
- **Status:** complete

### Phase 111: AP Payment Void And Reversal
- [x] Add module-level `voidBillPayment` for posted bill payments.
- [x] Restore applied bill balances through a combined store method and keep payment application rows as the reversal audit trail.
- [x] Require accounting reversal through the AP accounting poster when the payment has a journal entry.
- [x] Add payment-void hooks, event metadata, docs, OpenAPI, catalog entries, and template locks.
- [x] Add a guarded payment-detail action/form backed by accounting-core `voidJournalEntry` reversal semantics.
- [x] Verify AP tests/spec/build and accounting template spec/build before workspace checks.
- **Status:** complete

### Phase 112: AP Posted Bill Reversal
- [x] Extend `voidBill` so unpaid posted bills can be voided through an accounting-core reversal hook.
- [x] Keep bill payment guards in place; operators must void/reverse payments before reversing a posted bill.
- [x] Preserve original bill accounting references while emitting `originalJournalEntryId` and `reversalEntryId`.
- [x] Extend the accounting template AP poster with retry-safe bill journal reversal via `voidJournalEntry`.
- [x] Add posted bill reversal fields to the bill detail void form and audit payload.
- [x] Verify AP tests/build and accounting template build before workspace checks.
- **Status:** complete

### Phase 113: CLI Module Manifest Apply
- [x] Add explicit `add --apply` and `remove --apply` paths for local `microservices.config.json` and `microservices.lock.json` mutation.
- [x] Preserve `add --plan` as the review-first path and require `--apply` for removals.
- [x] Compose from the manifest so generated output can read local module intent without repeating `--modules`.
- [x] Add CLI tests for add, duplicate/default rejection, removal, dependent-module blocking, and manifest-backed generation.
- [x] Update docs to show `--apply` as the explicit manifest mutation path.
- **Status:** complete

### Phase 114: Root CLI Template Catalog Sync
- [x] Expose bundled repo-style templates through `@microservices-sh/module-contract` so root CLI `templates list/inspect`, `compose`, `validate`, and `check` see the same template ids as create-app.
- [x] Add `saas-growth-sveltekit` to the create-app template registry so the bundled template appears in filtered listings.
- [x] Keep root procedural `generate` honest by returning `REPO_TEMPLATE_GENERATE_UNSUPPORTED` for SvelteKit/Astro repo templates with a `create-microservices-app --template <id>` remediation.
- [x] Add module-contract, CLI, and create-app registry tests for template catalog coherence.
- [x] Verify module-contract/sdk/CLI builds, targeted tests, create-app build/tests, workspace specs, and whitespace checks.
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

# Progress Log

## Session: 2026-06-12

### Phase 1: Requirements And Discovery
- **Status:** complete
- **Started:** 2026-06-12T20:41:52Z
- Actions taken:
  - Reviewed user direction from the conversation.
  - Loaded local planning-with-files guidance.
  - Loaded Cloudflare and Workers guidance.
  - Verified relevant Cloudflare and MCP assumptions against primary documentation.
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

### Phase 2: Planning Artifacts
- **Status:** complete
- Actions taken:
  - Created a strategy review.
  - Created an MVP scope document.
  - Created validation, development, architecture, agent interface, GTM, metrics, risk, and interview documents.
- Files created/modified:
  - `plans/README.md`
  - `plans/00-strategy-review.md`
  - `plans/01-mvp-scope.md`
  - `plans/02-product-validation.md`
  - `plans/03-development-roadmap.md`
  - `plans/04-cloudflare-architecture.md`
  - `plans/05-agent-interface-and-module-contract.md`
  - `plans/06-gtm-promotion.md`
  - `plans/07-success-metrics-pricing.md`
  - `plans/08-risk-register.md`
  - `plans/09-interview-script.md`

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| File inventory | `rg --files` | Planning files listed | 13 planning files plus `skills-lock.json` listed | Pass |
| Content consistency | `rg -n "SaaS apps|production SaaS|SaaS products|production apps|business systems|agent-native application infrastructure" task_plan.md findings.md progress.md plans` | SaaS treated as one use case, not category | Positioning is broader across the docs; SaaS-only phrases appear only as corrections or explicit non-primary wording | Pass |
| Proposition/pricing consolidation | `rg -n "Builder|\\$49|\\$99|\\$299|Cloudflare gives|hosting markup|agent-native application infrastructure|product proposition|Workers for Platforms" .agents/product-marketing.md findings.md task_plan.md progress.md plans` | New proposition and pricing frame appear in intended documents | Product marketing, plan docs, findings, and task plan all include the consolidated direction | Pass |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-06-12T20:41:52Z | No local `ultracode` skill available | 1 | Used the requested workflow as a strict gate-based planning style. |
| 2026-06-12T20:41:52Z | `git diff --stat` and `git status --short` failed because the directory is not a git repository | 1 | Verified files with `rg --files`, `wc -l`, and content search instead. |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | Phase 5: delivery. |
| Where am I going? | Final file verification and user summary. |
| What's the goal? | Create actionable planning documents for microservices.sh MVP. |
| What have I learned? | See `findings.md`. |
| What have I done? | Created root planning files and the `plans/` artifact set. |

## Session: 2026-06-13

### Phase 6: Proposition And Pricing Consolidation
- **Status:** complete
- Actions taken:
  - Consolidated product proposition, niche, USPs, pricing, and competitive pricing frame.
  - Verified current public Cloudflare and Vercel pricing references before adding pricing guidance.
  - Created canonical product marketing context for future marketing work.
  - Added a consolidated proposition/pricing plan document.
  - Updated strategy, pricing, validation, GTM, interview, findings, and task plan files.
- Files created/modified:
  - `.agents/product-marketing.md`
  - `plans/10-product-proposition-pricing.md`
  - `plans/README.md`
  - `plans/00-strategy-review.md`
  - `plans/02-product-validation.md`
  - `plans/06-gtm-promotion.md`
  - `plans/07-success-metrics-pricing.md`
  - `plans/09-interview-script.md`
  - `findings.md`
  - `task_plan.md`
  - `progress.md`

### Phase 7: Marketing Research Verification
- **Status:** complete
- Actions taken:
  - Used customer-research, competitor-profiling, pricing, product-marketing, and launch/GTM lenses to audit the validation plan.
  - Checked secondary sources for AI adoption/trust, agent-native competitor movement, boilerplate willingness-to-pay, connector competition, and Cloudflare pricing.
  - Added explicit confidence levels and primary research gaps.
  - Updated the validation plan with research status and required interview segment mix.
- Files created/modified:
  - `plans/11-market-research-verification.md`
  - `plans/README.md`
  - `plans/02-product-validation.md`
  - `findings.md`
  - `task_plan.md`
  - `progress.md`

### Phase 8: Assumption-Level Validation
- **Status:** complete
- Actions taken:
  - Scored each major assumption using public market, competitor, pricing, and platform sources.
  - Marked macro AI adoption, AI trust gap, agent-native category movement, setup-pain WTP proxy, raw Cloudflare pricing, and managed-platform technical feasibility as validated or strongly supported.
  - Marked agency WTP, managed-vs-BYO preference, booking as first template, exact pricing, and module trust as primary-research requirements.
  - Added explicit interview/prototype tests for the still-unvalidated assumptions.
- Files created/modified:
  - `plans/12-assumption-validation-results.md`
  - `plans/README.md`
  - `plans/02-product-validation.md`
  - `findings.md`
  - `task_plan.md`
  - `progress.md`

### Phase 9: MCP Directory Distribution
- **Status:** complete
- Actions taken:
  - Used the directory-submissions skill to assess fit and readiness.
  - Checked current MCP discovery surfaces: official MCP Registry, Glama, PulseMCP, and MCP.so.
  - Added MCP directory distribution as an early high-intent validation channel.
  - Added readiness gates so directory submissions wait until the MCP server, docs, manifest, security page, and demo are credible.
- Files created/modified:
  - `plans/13-mcp-directory-distribution.md`
  - `plans/README.md`
  - `plans/06-gtm-promotion.md`
  - `plans/02-product-validation.md`
  - `findings.md`
  - `task_plan.md`
  - `progress.md`

### Phase 10: Landing Page Brand Brief
- **Status:** complete
- Actions taken:
  - Consolidated the honey bee net idea into a neon green honeycomb module network visual direction.
  - Anchored the design brief to the primary ICP: AI-heavy dev agencies, consultants, and fractional CTOs.
  - Added conversion goals, hero copy, page structure, visual guardrails, proof assets, analytics events, and success criteria.
- Files created/modified:
  - `plans/14-landing-page-brand-brief.md`
  - `plans/README.md`
  - `task_plan.md`
  - `progress.md`
  - `findings.md`

### Phase 11: Hono Cloudflare Runtime Decision
- **Status:** complete
- Actions taken:
  - Reviewed `~/Project/favcrm/v2/api` Hono/Workers structure, including customer, merchant, aux, background, and MCP workers.
  - Confirmed useful patterns: OpenAPIHono, shared `HonoEnv`, Drizzle/D1 middleware, error handler, audit middleware, request IDs, service bindings, queues, background handlers, MCP worker, `nodejs_compat`, and observability.
  - Added a dedicated runtime decision doc and updated architecture, roadmap, module contract, product context, findings, and task plan.
- Files created/modified:
  - `plans/15-hono-cloudflare-runtime-decision.md`
  - `plans/README.md`
  - `plans/04-cloudflare-architecture.md`
  - `plans/03-development-roadmap.md`
  - `plans/05-agent-interface-and-module-contract.md`
  - `.agents/product-marketing.md`
  - `task_plan.md`
  - `progress.md`
  - `findings.md`

### Phase 12: CLI, SDK, And MCP Packaging
- **Status:** complete
- Actions taken:
  - Reviewed current MCP/interface/runtime docs and checked MCP transport guidance.
  - Decided that hosted MCP, CLI, and internal TypeScript SDK are MVP requirements.
  - Sequenced local stdio MCP as P1, Dockerized MCP as P1.5, and public SDK as P2.
  - Added setup, validation, and success criteria for CLI, SDK, local MCP, and Dockerized MCP.
- Files created/modified:
  - `plans/16-cli-sdk-mcp-packaging.md`
  - `plans/README.md`
  - `plans/05-agent-interface-and-module-contract.md`
  - `plans/13-mcp-directory-distribution.md`
  - `plans/03-development-roadmap.md`
  - `task_plan.md`
  - `progress.md`
  - `findings.md`

### Phase 13: Detailed MVP Execution Plan
- **Status:** complete
- Actions taken:
  - Created a detailed MVP plan with v0 validation shell, v1 agent-to-local app, v2 managed preview deploy, and v3 paid beta.
  - Expanded exact module scope, product surfaces, architecture, generated project structure, validation metrics, acceptance criteria, non-goals, and first 14/30-day checklists.
  - Linked the new MVP plan from the planning index and recorded the staged MVP decision.
- Files created/modified:
  - `plans/17-mvp-detailed-execution-plan.md`
  - `plans/README.md`
  - `task_plan.md`
  - `progress.md`
  - `findings.md`

### Phase 14: MVP Agent Surface Scaffold
- **Status:** complete
- Actions taken:
  - Verified that another agent had already created the landing page, API Worker, and monorepo scaffold.
  - Added `packages/module-contract` with Auth, Customer, Booking, and the booking-business template.
  - Added `packages/sdk-internal` as the shared facade for CLI now and future MCP/control-plane surfaces.
  - Added `apps/cli` with stable `--json` commands for list, inspect, compose, validate, check, and generate.
  - Generated an inspectable booking-business Hono/Cloudflare Worker example under `generated/examples/booking-business`.
  - Fixed root pnpm argument forwarding and generated output path behavior.
  - Fixed generated app strict TypeScript issues around JSON body parsing and audit payload typing.
- Files created/modified:
  - `apps/cli/package.json`
  - `apps/cli/src/index.js`
  - `packages/module-contract/package.json`
  - `packages/module-contract/src/index.js`
  - `packages/module-contract/src/index.d.ts`
  - `packages/sdk-internal/package.json`
  - `packages/sdk-internal/src/index.js`
  - `packages/sdk-internal/src/index.d.ts`
  - `generated/examples/booking-business/`
  - `plans/18-mvp-agent-surface-implementation.md`
  - `plans/README.md`
  - `README.md`
  - `packages/README.md`
  - `package.json`
  - `pnpm-lock.yaml`
  - `task_plan.md`
  - `progress.md`
  - `findings.md`

## Latest Verification Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|

## Session: 2026-06-18

### Phase 31: DOT AI OS Template
- **Status:** complete
- Actions taken:
  - Checked create-app CLI behavior and confirmed `dot-ai-os` belongs in repo-style template registration, not `frameworks.json`.
  - Ran modern-web-guidance search/retrieval for dashboard UI forms, CSS/layout, and performance guidance.
  - Copied the `erp-shell-sveltekit` source skeleton into `templates/dot-ai-os` without generated `.svelte-kit`, `.wrangler`, `dist`, or `node_modules` folders.
  - Rebranded the template manifest, package metadata, config, content schema, app shell, docs, and visible route copy to DOT AI OS.
  - Added DOT AI OS workspace routes for focus planning, daily review, and knowledge log.
  - Registered `dot-ai-os` in `create-microservices-app` repo-template metadata/build lists and added `calendar-google` to the bundled module allowlist.
  - Updated root, template, and create-package template listings.
- Files created/modified so far:
  - `templates/dot-ai-os/`
  - `README.md`
  - `templates/README.md`
  - `packages/create-microservices-app/README.md`
  - `packages/create-microservices-app/src/index.js`
  - `packages/create-microservices-app/scripts/build.js`
  - `packages/create-microservices-app/dist/index.js`
  - `pnpm-lock.yaml`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm spec:check -- template templates/dot-ai-os` | DOT AI OS template spec passes | Passed | Pass |
| `pnpm --filter @microservices-sh/template-dot-ai-os build:app` | DOT AI OS SvelteKit build passes | Passed | Pass |
| `pnpm --dir packages/create-microservices-app build` | Create package bundle includes `dot-ai-os` | Passed | Pass |
| `pnpm create:local -- dot-ai-os-check --template dot-ai-os --dir /tmp --no-install --no-git --json` | Local create path writes the template | Passed, wrote `/tmp/dot-ai-os-check` | Pass |
| `pnpm --dir /tmp/dot-ai-os-check microservices check --json` | Generated app contract checks pass | Passed | Pass |
| `pnpm --filter create-microservices-app test` | Create package tests pass | 15/15 passed | Pass |

### Phase 32: DOT AI OS Upstream-Informed Revamp
- **Status:** complete
- Actions taken:
  - Loaded planning, frontend, modern-web, and Cloudflare guidance.
  - Re-read planning files and ran the planning session catchup script.
  - Refreshed `/tmp/jimmy-dashboard-OS` and inspected the upstream Vite/React/Express/SQLite app, product docs, data files, and UI direction.
  - Mapped upstream product concepts onto the Cloudflare/microservices.sh template boundary instead of copying the upstream backend/runtime assumptions.
  - Added `src/lib/os-data.ts` as template-owned sample UI contract data for tasks, focus plan, calendar events, knowledge stages, content stages, AI workers, and review signals.
  - Reworked the DOT AI OS workbench into a Clear Workbench-style operator dashboard with Today, Tasks, Focus plan, Calendar, Daily review, Knowledge log, Content pipeline, and AI team routes.
  - Updated template docs, agent docs, API-boundary notes, template metadata, CLI listing copy, and template contract checks for the upstream-informed surfaces.
  - Removed generated `.svelte-kit` and `node_modules` artifacts from `templates/dot-ai-os` after validation.

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm spec:check -- template templates/dot-ai-os` | DOT AI OS template spec passes | Passed | Pass |
| `pnpm --filter @microservices-sh/template-dot-ai-os build:app` | DOT AI OS app build passes | Passed | Pass |
| `pnpm --dir packages/create-microservices-app build` | Create package bundle includes updated `dot-ai-os` | Passed | Pass |
| `pnpm create:local -- dot-ai-os-revamp-check --template dot-ai-os --dir /tmp --no-install --no-git --json` | Local create path writes updated template | Passed, wrote `/tmp/dot-ai-os-revamp-check` | Pass |
| `pnpm --dir /tmp/dot-ai-os-revamp-check microservices check --json` | Generated DOT AI OS project checks pass | Passed | Pass |
| `pnpm --filter create-microservices-app test` | Create package tests pass | 15/15 passed | Pass |
| `git diff --check` | No whitespace errors | Passed with no output | Pass |
| CSS/design guard search | No viewport-scaled fonts or negative tracking in `templates/dot-ai-os/src` | No matches | Pass |
  - Ran modern-web-guidance search for dense operator-dashboard layout patterns; `css-layout` is the relevant guide to retrieve.
  - Observed unrelated dirty worktree changes outside `dot-ai-os`; these will be preserved.
  - Retrieved `css-layout` guidance: use grid for page skeletons, flex for rows/toolbars, container queries for component-local adaptation, and stable scroll containers for dense panes.
  - Verified upstream clone `/tmp/jimmy-dashboard-OS` is aligned with `origin/main` at commit `705f287`.
  - Read upstream README, PRODUCT, DESIGN, package metadata, and file map to extract product scope and design constraints.
- Files created/modified so far:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
| `pnpm install --offline` | Workspace links update without network downloads | Completed with no downloads | Pass |
| `pnpm cli -- templates list --json` | Returns booking-business template | Returned stable SDK envelope | Pass |
| `pnpm cli -- modules list --json` | Returns Auth, Customer, Booking | Returned all three modules | Pass |
| `pnpm cli -- compose booking-business --json` | Resolves module dependency order and contracts | Resolved Auth -> Customer -> Booking | Pass |
| `pnpm cli -- validate booking-business --json` | Returns config/binding validation | Returned valid result with expected default-config warnings | Pass |
| `pnpm cli -- check booking-business --json` | Contract checks pass and managed preview remains pending | Returned pass checks plus pending managed-preview | Pass |
| `pnpm cli -- generate booking-business --out /tmp/microservices-generated-booking --json` | Writes generated app files | Wrote 13 files | Pass |
| Generated app `pnpm typecheck` | Strict TypeScript passes | Passed | Pass |
| `pnpm build` | Monorepo build passes | Passed with existing Astro/Cloudflare warnings | Pass |
| `pnpm --filter api typecheck` | API Worker typecheck passes | Passed | Pass |
| `pnpm --filter api exec wrangler deploy --dry-run` | API Worker dry-run deploy passes | Passed with Wrangler version warning | Pass |
| `pnpm --filter landing-page build` | Landing page build passes | Passed with existing Astro/Cloudflare warnings | Pass |

### Phase 15: Hosted MCP Preview Endpoint
- **Status:** complete
- Actions taken:
  - Added `apps/api/src/mcp.ts` as a JSON-RPC MCP adapter over `packages/sdk-internal`.
  - Added `GET /mcp` metadata for quick inspection.
  - Added `POST /mcp` support for `initialize`, `ping`, `tools/list`, and `tools/call`.
  - Exposed eight SDK-backed tools: `list_templates`, `inspect_template`, `list_modules`, `inspect_module`, `compose_app`, `validate_config`, `generate_project`, and `run_checks`.
  - Added the API dependency on `@microservices-sh/sdk-internal`.
  - Added explicit package `import` export conditions so the API typechecker resolves workspace packages.
  - Verified local runtime behavior with Wrangler dev and `curl` calls.
- Files created/modified:
  - `apps/api/src/mcp.ts`
  - `apps/api/src/index.ts`
  - `apps/api/package.json`
  - `packages/module-contract/package.json`
  - `packages/sdk-internal/package.json`
  - `README.md`
  - `plans/18-mvp-agent-surface-implementation.md`
  - `task_plan.md`
  - `progress.md`

## Latest MCP Verification Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `curl http://localhost:8787/mcp` | Returns endpoint metadata and tool list | Returned protocol `2025-06-18` and 8 tools | Pass |
| JSON-RPC `initialize` | Returns server info and tool capability | Returned `microservices.sh` server info | Pass |
| JSON-RPC `tools/list` | Returns tool schemas | Returned all 8 tool definitions | Pass |
| JSON-RPC `tools/call` with `inspect_module` | Returns booking module contract | Returned booking module via SDK response envelope | Pass |
| JSON-RPC `tools/call` with `run_checks` | Returns contract check results | Returned pass checks plus pending managed-preview | Pass |
| JSON-RPC `tools/call` with `compose_app` and config override | Returns composed app with config override | Returned `Studio Demo` composition | Pass |
| `pnpm --filter api typecheck` | API typecheck passes | Passed | Pass |
| `pnpm --filter api exec wrangler deploy --dry-run` | API Worker bundles for deploy | Passed with Wrangler version warning | Pass |
| `pnpm build` | Monorepo build still passes | Passed with existing Astro/Cloudflare warnings | Pass |

### Phase 16: Preview Deployment Control Plane
- **Status:** complete
- Actions taken:
  - Added D1 tables for `projects`, `deployment_artifacts`, `deployments`, and `deployment_logs`.
  - Added `apps/api/src/control-plane.ts` with project creation, preview deployment preparation, status lookup, log lookup, and disable behavior.
  - Added HTTP routes: `POST /projects`, `GET /projects/:id`, `POST /deployments/preview`, `GET /deployments/:id`, `GET /deployments/:id/logs`, and `POST /deployments/:id/disable`.
  - Added managed dev deployment preparation with `POST /deployments/dev`, MCP `deploy_dev`, and CLI `deploy dev`.
  - Added deployment artifact export with `GET /deployments/:id/artifact`, MCP `get_deployment_artifact`, and CLI `deploy artifact --out <dir>`.
  - Added MCP tools: `deploy_dev`, `deploy_preview`, `get_deployment_status`, `get_deployment_artifact`, and `get_logs`.
  - Added CLI commands: `deploy dev`, `deploy preview`, `deploy status`, `deploy artifact`, `deploy logs`, and `logs`.
  - Verified prepared deployment records, generated artifact checksums, logs, disabled state, and MCP/CLI access.
- Files created/modified:
  - `apps/api/src/control-plane.ts`
  - `apps/api/src/index.ts`
  - `apps/api/src/mcp.ts`
  - `apps/api/schema.sql`
  - `apps/cli/src/index.js`
  - `packages/sdk-internal/src/index.js`
  - `README.md`
  - `plans/18-mvp-agent-surface-implementation.md`
  - `task_plan.md`
  - `progress.md`

## Latest Preview Control Plane Verification Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm --filter api db:init` | Applies local D1 schema | 12 SQL commands executed | Pass |
| `POST /deployments/preview` | Creates project, artifact, deployment, and logs | Returned `prepared` deployment with checksum and 13 files | Pass |
| `GET /deployments/:id` | Returns deployment status and artifact metadata | Returned `prepared` status | Pass |
| `GET /deployments/:id/logs` | Returns lifecycle logs | Returned accepted, artifact stored, and provisioning-pending logs | Pass |
| `POST /deployments/:id/disable` | Marks deployment disabled and appends log | Returned `disabled` deployment | Pass |
| MCP `deploy_preview` | Creates prepared deployment through MCP | Returned prepared deployment and artifact | Pass |
| MCP `deploy_dev` | Creates a prepared dev deployment through MCP | Added tool path with `environment: dev` | Pass |
| MCP `tools/list` | Includes deployment tools | Includes `deploy_dev`, `deploy_preview`, status, and logs tools | Pass |
| CLI `deploy dev` | Creates a prepared dev deployment through API | Added first-class command that posts to `/deployments/dev` | Pass |
| Deployment artifact export | Returns generated files for a prepared deployment | Added API/MCP/CLI artifact export so generated project files can be written before build/upload | Pass |
| CLI `deploy preview` | Creates prepared deployment through API | Passed with local-network approval | Pass |
| CLI `deploy status` | Reads deployment status through API | Returned prepared and disabled states during verification | Pass |
| CLI `deploy logs` | Reads deployment logs through API | Returned lifecycle logs | Pass |
| `pnpm --filter api typecheck` | API typecheck passes | Passed | Pass |
| `pnpm --filter api exec wrangler deploy --dry-run` | API Worker bundles for deploy | Passed with Wrangler version warning | Pass |

### Phase 17: Guarded Cloudflare Resource Provisioning
- **Status:** complete
- Actions taken:
  - Added `deployment_resources` with one resource row per deployment/resource type/binding.
  - Added resource-plan derivation from the generated `wrangler.jsonc` artifact.
  - Added guarded provisioning that requires `CF_PROVISIONING_ENABLED=true`, `CLOUDFLARE_ACCOUNT_ID`, and the `CLOUDFLARE_API_TOKEN` Worker secret before calling Cloudflare API v4.
  - Added a production provisioning confirmation guard so production deployments require `confirm: "production"` or CLI `--confirm production`.
  - Added explicit production deployment preparation through API, MCP, and CLI.
  - Added deployment artifact manifest metadata so exports include Worker entrypoint, scripts, binding placeholders, and upload readiness.
  - Added CLI artifact verification for exported deployment source before bundling or upload.
  - Added CLI binding rewrite for exported deployment artifacts after D1/KV provisioning or explicit resource-id input.
  - Added guarded CLI remote D1 migration wrapper for exported deployment artifacts.
  - Added guarded CLI upload wrapper around Wrangler deploy for exported artifacts.
  - Added deployment activation endpoint, MCP tool, and CLI command to persist live Worker URLs.
  - Added hosted deployment upload-plan API, MCP tool, and CLI command to expose upload readiness and local fallback commands.
  - Added CLI deployment pipeline planner for ordered dev/preview/production steps.
  - Added CLI doctor diagnostics for API auth, local tooling, Wrangler, and deployment artifact readiness.
  - Added D1 and KV provisioning calls for configured control planes.
  - Kept hosted Worker upload explicit as a skipped/pending adapter while local Wrangler upload can be recorded through activation.
  - Added HTTP routes: `POST /deployments/:id/provision` and `GET /deployments/:id/resources`.
  - Added MCP tools: `provision_deployment` and `get_deployment_resources`.
  - Added CLI commands: `deploy provision` and `deploy resources`.
  - Updated README and MVP implementation docs with the current lifecycle and configuration.
- Files created/modified:
  - `apps/api/src/control-plane.ts`
  - `apps/api/src/index.ts`
  - `apps/api/src/mcp.ts`
  - `apps/api/schema.sql`
  - `apps/api/wrangler.jsonc`
  - `apps/cli/src/index.js`
  - `packages/sdk-internal/src/index.js`
  - `README.md`
  - `plans/18-mvp-agent-surface-implementation.md`
  - `task_plan.md`
  - `progress.md`

## Latest Provisioning Verification Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm --filter api db:init` | Applies local D1 schema including `deployment_resources` | 15 SQL commands executed | Pass |
| `POST /deployments/preview` | Creates a fresh prepared deployment | Returned `dep_685043978ad840e4b5` with 13-file artifact | Pass |
| `POST /deployments/:id/provision` without credentials | Returns explicit configuration error and persists planned resources | Returned `PROVISIONING_NOT_CONFIGURED` with planned D1, KV, and Worker rows | Pass |
| `GET /deployments/:id/resources` | Returns persisted resource plan | Returned D1 `DB`, KV `CACHE_KV`, and Worker `WORKER` resources | Pass |
| `GET /deployments/:id/logs` | Records provisioning request outcome | Returned lifecycle logs including missing provisioning config | Pass |
| MCP `provision_deployment` | Returns structured tool error for missing config | Returned `isError: true` with `PROVISIONING_NOT_CONFIGURED` structured content | Pass |
| MCP `tools/list` | Includes provisioning tools | Returned 13 tools including `provision_deployment` and `get_deployment_resources` | Pass |
| CLI `deploy provision` | Surfaces same API result | Returned structured `ok: false` config error with resources | Pass |
| Production provisioning guard | Blocks production resource provisioning without explicit confirmation | Added API/MCP/CLI confirmation plumbing and server-side `PRODUCTION_CONFIRMATION_REQUIRED` guard | Pass |
| CLI `deploy resources` | Reads resource plan through API | Returned planned D1/KV/Worker rows | Pass |
| `pnpm --filter api typecheck` | API typecheck passes | Passed | Pass |
| `pnpm --filter api exec wrangler deploy --dry-run` | API Worker bundles for deploy | Passed with Wrangler version warning; vars include `CF_PROVISIONING_ENABLED=false` | Pass |
| `pnpm build` | Monorepo build passes | Passed | Pass |
| `node --check apps/cli/src/index.js` | CLI syntax passes | Passed | Pass |

### Phase 18: Module Documentation, Structure, Source Ownership, And Permission Gates
- **Status:** complete
- Actions taken:
  - Added LLM-friendly module docs under `docs/modules`.
  - Added a compact LLM guide at `docs/llms.txt`.
  - Added a machine-readable module catalog at `docs/modules/catalog.json`.
  - Added `docs/modules/module-spec-standard.md` to define the broader-than-OpenAPI module documentation standard.
  - Added `docs/modules/module-package-structure.md` to define canonical module folders, the safe `src/index.ts` entrypoint, package exports, runtime registration, overlays, and agent checklist.
  - Updated the module package standard to use folder-level `index.ts` barrel exports for each top-level concern.
  - Added module docs for `auth`, `customer`, `booking`, `payment-stripe`, `email`, and `audit-log`.
  - Added `plans/19-module-docs-source-and-permissions.md` to consolidate provider modules, secrets/env vars, permission gates, source ownership, deployment modes, LLM docs, and the `microservices-sh` managed namespace.
  - Updated architecture, agent interface, MVP execution, implementation, planning index, README, and landing-page `llms.txt` docs with the new decisions.
- Files created/modified:
  - `docs/llms.txt`
  - `docs/modules/README.md`
  - `docs/modules/catalog.json`
  - `docs/modules/module-spec-standard.md`
  - `docs/modules/module-package-structure.md`
  - `docs/modules/_template.md`
  - `docs/modules/auth.md`
  - `docs/modules/customer.md`
  - `docs/modules/booking.md`
  - `docs/modules/payment-stripe.md`
  - `docs/modules/email.md`
  - `docs/modules/audit-log.md`
  - `plans/19-module-docs-source-and-permissions.md`
  - `plans/README.md`
  - `plans/04-cloudflare-architecture.md`
  - `plans/05-agent-interface-and-module-contract.md`
  - `plans/17-mvp-detailed-execution-plan.md`
  - `plans/18-mvp-agent-surface-implementation.md`
  - `README.md`
  - `apps/landing-page/public/llms.txt`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

### Phase 19: CLI-First Create App Strategy Audit
- **Status:** complete
- Actions taken:
  - Audited planning docs for MCP-first activation assumptions.
  - Added `plans/20-cli-first-create-app-strategy.md` as the current go-forward strategy.
  - Re-sequenced MVP activation around `npm create microservices-app@latest` / `pnpm create microservices-app`.
  - Defined create package, project CLI, internal SDK, hosted MCP, local MCP, Dockerized MCP, and public SDK priorities.
  - Updated MVP scope, validation, roadmap, GTM, success metrics, directory distribution, landing brief, agent interface, packaging, implementation, README, and LLM docs for CLI-first activation.
  - Preserved existing hosted MCP/control-plane work as useful parity infrastructure, not the first onboarding dependency.
- Files created/modified:
  - `plans/20-cli-first-create-app-strategy.md`
  - `plans/16-cli-sdk-mcp-packaging.md`
  - `plans/01-mvp-scope.md`
  - `plans/02-product-validation.md`
  - `plans/03-development-roadmap.md`
  - `plans/04-cloudflare-architecture.md`
  - `plans/05-agent-interface-and-module-contract.md`
  - `plans/06-gtm-promotion.md`
  - `plans/07-success-metrics-pricing.md`
  - `plans/13-mcp-directory-distribution.md`
  - `plans/14-landing-page-brand-brief.md`
  - `plans/17-mvp-detailed-execution-plan.md`
  - `plans/18-mvp-agent-surface-implementation.md`
  - `plans/19-module-docs-source-and-permissions.md`
  - `plans/README.md`
  - `README.md`
  - `docs/llms.txt`
  - `apps/landing-page/public/llms.txt`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

### Phase 20: Create-App Distribution And Update Scaffold
- **Status:** distribution scaffold complete; npm release workflow added; upgrade-plan core added; npm env, first publish decision, and template expansion pending
- Actions taken:
  - Added `packages/create-microservices-app` with a `create-microservices-app` bin, package metadata, README, safe directory writes, `--dir`, `--template`, `--config`, `--no-install`, and `--json`.
  - Added root `pnpm create:local -- ...` helper for local smoke tests.
  - Extended generated apps with `docs/llms.txt`, `docs/modules/catalog.json`, one Markdown module doc per catalog module, `microservices.config.json`, a richer `microservices.lock.json`, and `scripts/microservices.js`.
  - Added generated project CLI commands: `modules list`, `modules inspect`, `docs`, `add --plan`, `secrets status`, `updates`, `upgrade --plan`, and `check`.
  - Added matching SDK/repo CLI functions for module docs, add plans, secret status, update status, and upgrade plans.
  - Added MCP parity tools for module docs, add planning, secrets status, update checks, and upgrade planning.
  - Extended generated `microservices.lock.json` module entries with route, binding, resource, permission, hook, event, and dependency contract snapshots for future diffs.
  - Bundled the create package into `dist/index.js` with esbuild so the packed tarball has no runtime workspace dependency.
  - Verified the packed tarball by extracting it under `/tmp` and running `node package/dist/index.js`.
  - Added `pnpm test:create` smoke test for build, pack, extract, generate, and generated project CLI commands.
  - Improved guided setup so interactive create-app prompts show numbered template, module, and package-manager choices while keeping optional Git remote setup.
  - Verified a throwaway app generation under `/tmp` and validated generated project CLI commands.
  - Added manual npm publish workflow with provenance support, default dry-run behavior, and a real-publish gate on `NPM_PUBLISH_ENABLED` plus `NPM_TOKEN`.
  - Documented predefined repo-style templates as the next layer after the module/update core, starting with booking, landing page, and blog/content foundations.
- Files created/modified:
  - `packages/create-microservices-app/package.json`
  - `packages/create-microservices-app/src/index.js`
  - `packages/create-microservices-app/scripts/build.js`
  - `packages/create-microservices-app/scripts/smoke-test.js`
  - `packages/create-microservices-app/dist/index.js`
  - `packages/create-microservices-app/README.md`
  - `.github/workflows/npm-publish.yml`
  - `packages/sdk-internal/src/index.js`
  - `packages/sdk-internal/src/index.d.ts`
  - `packages/module-contract/src/index.js`
  - `packages/module-contract/src/index.d.ts`
  - `apps/cli/src/index.js`
  - `apps/api/src/mcp.ts`
  - `docs/llms.txt`
  - `apps/landing-page/public/llms.txt`
  - `package.json`
  - `pnpm-lock.yaml`
  - `README.md`
  - `packages/README.md`
  - `plans/18-mvp-agent-surface-implementation.md`
  - `plans/20-cli-first-create-app-strategy.md`
  - `task_plan.md`
  - `progress.md`

## Latest Create-App Distribution Verification Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm cli -- upgrade booking --plan --json` | Repo CLI returns a structured module upgrade plan | Passed; returned no-op plan with lockfile contract diff data | Pass |
| `pnpm test:create` | Build, pack, extract, generate, and generated project CLI smoke test passes | Passed; packed tarball contains `dist/index.js`, `package.json`, and `README.md`; generated CLI includes `upgrade booking --plan --json` | Pass |
| `pnpm --filter api typecheck` | API Worker/MCP typecheck passes | Passed | Pass |
| `pnpm build` | Workspace build passes | Passed across landing page, create package, module contract, SDK, and CLI | Pass |
| `git diff --check` | No whitespace errors | Passed with no output | Pass |

### Phase 21: Flexible Template Spec And Booking SvelteKit Shell
- **Status:** first runnable booking SvelteKit shell complete with real customer+booking module composition; browser screenshot verification and provider modules pending
- Actions taken:
  - Added a template spec index under `docs/templates`.
  - Added a reusable template spec standard that defines manifest shape, slots, customization levels, Cloudflare bindings, permission gates, upgrade requirements, and acceptance criteria.
  - Added `booking-sveltekit` as the first full Cloudflare SvelteKit booking app template spec.
  - Updated LLM docs and planning index so future agents can find the template spec before implementation.
  - Added `templates/*` to the pnpm workspace.
  - Added `templates/booking-sveltekit` with manifest, config, lockfile, agent guide, API-boundary docs, and booking/customer module dependency wiring.
  - Added a runnable SvelteKit app shell with public booking, booking lookup, admin overview, API routes, hooks, Cloudflare adapter config, and responsive CSS.
  - Added detached customer and booking use cases, schemas, types, hooks, repository ports, memory adapters, and D1 adapters under prebuilt `modules/customer` and `modules/booking` packages.
  - Added D1 migrations for customers, services, bookings, domain events, audit events, and seed services.
  - Applied the D1 migrations locally with Wrangler and verified the seeded services.
  - Started the SvelteKit dev server and verified homepage, booking form, availability API, booking creation API, and admin overview with sequential HTTP smoke checks.
  - Added admin booking/customer list and detail routes backed by detached booking/customer use cases.
  - Added `scripts/smoke-http.mjs` and `pnpm smoke:http` for repeatable route/API smoke coverage against a running dev server.
  - Extracted booking behavior into the first real prebuilt module package at `modules/booking`.
  - Rewired `templates/booking-sveltekit` to import `@microservices-sh/booking` instead of owning `src/lib/server/modules/booking`.
  - Extracted customer behavior into the second real prebuilt module package at `modules/customer`.
  - Rewired `templates/booking-sveltekit` to import `@microservices-sh/customer` for customer list/detail and customer creation during booking.
  - Adjusted the create-app smoke test so nested generated CLI commands run with inherited stdio in this sandboxed environment.
  - Added a reusable workspace spec checker for all current and future module/template packages.
  - Replaced duplicated per-package check scripts with package-level `microservices.check.mjs` policy files.
  - Added reusable `scaffold module` and `scaffold template` commands to `packages/workspace-tools`.
  - Added root aliases `pnpm scaffold:module -- <id>` and `pnpm scaffold:template -- <id>`.
  - Verified generated module and SvelteKit template scaffolds under `/tmp` with the shared checker.
  - Added read-only `registry build` and `discover` commands to derive local catalogs and inspect installed app module state without integration side effects.
  - Added local template CLI commands for module listing, module docs, upgrade planning, and template checks.
  - Updated workspace scripts and docs to include the concrete template package.
- Files created/modified:
  - `docs/templates/README.md`
  - `docs/templates/template-spec-standard.md`
  - `docs/templates/booking-sveltekit.md`
  - `templates/README.md`
  - `templates/booking-sveltekit/package.json`
  - `templates/booking-sveltekit/microservices.template.json`
  - `templates/booking-sveltekit/microservices.config.json`
  - `templates/booking-sveltekit/microservices.lock.json`
  - `templates/booking-sveltekit/README.md`
  - `templates/booking-sveltekit/README.agent.md`
  - `templates/booking-sveltekit/docs/llms.txt`
  - `templates/booking-sveltekit/docs/api-boundary.md`
  - `templates/booking-sveltekit/microservices.check.mjs`
  - `templates/booking-sveltekit/scripts/microservices.js`
  - `templates/booking-sveltekit/scripts/smoke-http.mjs`
  - `templates/booking-sveltekit/svelte.config.js`
  - `templates/booking-sveltekit/vite.config.ts`
  - `templates/booking-sveltekit/tsconfig.json`
  - `templates/booking-sveltekit/wrangler.jsonc`
  - `templates/booking-sveltekit/migrations/0001_core.sql`
  - `templates/booking-sveltekit/migrations/0002_seed.sql`
  - `templates/booking-sveltekit/src/app.html`
  - `templates/booking-sveltekit/src/app.css`
  - `templates/booking-sveltekit/src/app.d.ts`
  - `templates/booking-sveltekit/src/hooks.server.ts`
  - `templates/booking-sveltekit/src/routes/`
  - `templates/booking-sveltekit/src/lib/server/adapters/sveltekit-response.ts`
  - `modules/booking/package.json`
  - `modules/booking/module.json`
  - `modules/booking/README.md`
  - `modules/booking/README.agent.md`
  - `modules/booking/llms.txt`
  - `modules/booking/openapi.json`
  - `modules/booking/src/`
  - `modules/booking/schemas/`
  - `modules/booking/migrations/0001_booking.sql`
  - `modules/booking/microservices.check.mjs`
  - `modules/customer/package.json`
  - `modules/customer/module.json`
  - `modules/customer/README.md`
  - `modules/customer/README.agent.md`
  - `modules/customer/llms.txt`
  - `modules/customer/openapi.json`
  - `modules/customer/src/`
  - `modules/customer/schemas/`
  - `modules/customer/migrations/0001_customer.sql`
  - `modules/customer/microservices.check.mjs`
  - `packages/workspace-tools/package.json`
  - `packages/workspace-tools/src/index.js`
  - `packages/workspace-tools/README.md`
  - `.gitignore`
  - `packages/create-microservices-app/scripts/smoke-test.js`
  - `docs/modules/module-package-structure.md`
  - `docs/templates/template-spec-standard.md`
  - `packages/README.md`
  - `docs/llms.txt`
  - `plans/README.md`
  - `plans/20-cli-first-create-app-strategy.md`
  - `README.md`
  - `package.json`
  - `pnpm-workspace.yaml`
  - `task_plan.md`
  - `progress.md`

## Latest Booking SvelteKit Template Verification Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm --filter @microservices-sh/customer check:spec` | Prebuilt customer module has required metadata, docs, source, schemas, migration, and framework-neutral use cases | Passed | Pass |
| `pnpm --filter @microservices-sh/customer build` | Prebuilt customer module typechecks | Passed | Pass |
| `pnpm --filter @microservices-sh/booking check:spec` | Prebuilt booking module has required metadata, docs, source, schemas, migration, and framework-neutral use cases | Passed | Pass |
| `pnpm --filter @microservices-sh/booking build` | Prebuilt booking module typechecks | Passed | Pass |
| `pnpm spec:check -- all` | Shared workspace checker validates all current modules and templates | Passed for `modules/booking`, `modules/customer`, and `templates/booking-sveltekit` | Pass |
| `pnpm spec:check -- modules --json` | Shared checker emits agent-friendly JSON for module checks | Passed with detailed check envelopes for booking and customer | Pass |
| `node packages/workspace-tools/src/index.js scaffold module inventory --path /tmp/ms-scaffold-module --json --force` | Shared scaffold writes a valid module package shape | Wrote manifest, docs, schemas, source, migration, tests placeholder, and package policy file | Pass |
| `node packages/workspace-tools/src/index.js check module --path /tmp/ms-scaffold-module --json` | Generated module scaffold passes shared checks | Passed required files, exports, D1 migration, framework-neutral source, and policy checks | Pass |
| `node packages/workspace-tools/src/index.js scaffold template invoice-sveltekit --path /tmp/ms-scaffold-template --framework sveltekit --modules customer,booking --json --force` | Shared scaffold writes a valid SvelteKit template package shape | Wrote template manifest, config, lockfile, docs, scripts, SvelteKit starter files, and package policy file | Pass |
| `node packages/workspace-tools/src/index.js check template --path /tmp/ms-scaffold-template --json` | Generated SvelteKit template scaffold passes shared checks | Passed metadata, lockfile, local module dependency, SvelteKit required files, and policy checks | Pass |
| `pnpm scaffold:module -- catalog --path /tmp/microservices-scaffold-module-catalog-20260613 --json` | Root scaffold alias forwards module args correctly | Wrote a valid `catalog` module scaffold under `/tmp` | Pass |
| `pnpm scaffold:template -- portal-generic --path /tmp/microservices-scaffold-template-portal-generic-20260613 --json` | Root scaffold alias forwards template args correctly | Wrote a valid generic template scaffold under `/tmp` | Pass |
| `pnpm spec:check -- module /tmp/microservices-scaffold-module-catalog-20260613 --json` | Alias-generated module scaffold passes shared checks | Passed | Pass |
| `pnpm spec:check -- template /tmp/microservices-scaffold-template-portal-generic-20260613 --json` | Alias-generated generic template scaffold passes shared checks | Passed | Pass |
| `pnpm registry:build -- --json` | Derived registry is generated from local module/template manifests | Wrote ignored `.generated/registry/modules.json`, `templates.json`, and `catalog.json` with 2 modules and 1 template | Pass |
| `pnpm discover -- --json` | Read-only discovery reports available local modules/templates | Returned booking/customer modules and booking-sveltekit template with no app mutation | Pass |
| `pnpm discover -- --path templates/booking-sveltekit --json` | Read-only discovery reports installed module state from template lockfile and package dependencies | Reported customer and booking as current, auth/audit-log as not in local registry, no warnings | Pass |
| `pnpm --filter @microservices-sh/template-booking-sveltekit check:spec` | Workspace can find and run the template package check | Passed | Pass |
| `pnpm --filter @microservices-sh/template-booking-sveltekit microservices -- check --json` | Template project CLI check passes | Passed | Pass |
| `pnpm --filter @microservices-sh/template-booking-sveltekit microservices -- upgrade booking --json` | Template upgrade command returns a structured no-op plan | Passed | Pass |
| `pnpm --filter @microservices-sh/template-booking-sveltekit microservices -- modules list --json` | Template module catalog is inspectable | Passed | Pass |
| `pnpm --filter @microservices-sh/template-booking-sveltekit build:app` | SvelteKit Cloudflare build passes | Passed | Pass |
| `pnpm --filter @microservices-sh/template-booking-sveltekit exec wrangler d1 migrations apply booking_sveltekit --local` | Local D1 migrations apply successfully | Passed; `0001_core.sql`, `0002_seed.sql`, and `0003_booking_slot_constraints.sql` applied | Pass |
| `pnpm --filter @microservices-sh/template-booking-sveltekit exec wrangler d1 execute booking_sveltekit --local --command "SELECT id, name, duration_minutes FROM services ORDER BY id"` | Seeded services are queryable | Returned `svc-consultation` and `svc-standard` | Pass |
| `pnpm --filter @microservices-sh/template-booking-sveltekit dev` plus sequential `curl` checks | Local dev server renders and handles API requests | Homepage 200, `/book` 200, `/admin` 200, availability JSON returned slots, booking POST created a confirmed booking | Pass |
| `pnpm --filter @microservices-sh/template-booking-sveltekit smoke:http http://127.0.0.1:5184` | Reusable HTTP smoke covers public, API, duplicate-slot rejection, admin list, and admin detail routes | Passed; created booking/customer through composed customer+booking modules and verified 10 route/API checks including duplicate-slot `409` | Pass |
| `pnpm build` | Adding `modules/*`, `templates/*`, and shared workspace tooling does not break the workspace build | Passed across 10 of 11 workspace projects | Pass |
| `pnpm test:create` | Create package smoke test still passes | Passed | Pass |
| `pnpm --filter api typecheck` | API Worker/MCP typecheck still passes | Passed | Pass |
| `git diff --check` | No whitespace errors | Passed with no output | Pass |

### Phase 22: Auth-First Account, CLI, And Admin Portal Plan
- **Status:** auth-first implementation plan complete; first API auth slice is tracked in Phase 24
- Actions taken:
  - Reviewed current CLI auth and API bearer-token validation.
  - Confirmed current auth is a static-key bootstrap, not self-serve product auth.
  - Added an auth-first plan that precedes billing.
  - Defined user/workspace/session/API-key/device-code/audit data model.
  - Defined portal login, API-key management, CLI commands, future device login, security defaults, rollout, and verification gates.
  - Updated the planning index, task plan, findings, and billing plan prerequisite note.
- Files created/modified:
  - `plans/21-auth-first-account-and-cli-plan.md`
  - `plans/22-product-billing-cli-admin-portal.md`
  - `plans/README.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

## Latest Auth-First Planning Verification Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Current auth check | CLI/API auth status is clear | Current auth is static bearer-token bootstrap | Pass |
| Auth-first plan | Dedicated plan exists | `plans/21-auth-first-account-and-cli-plan.md` added | Pass |
| Billing dependency | Billing plan depends on auth | Billing plan now points to auth-first prerequisite | Pass |
| Security references | Auth/session guidance uses current primary references | OWASP auth/session and RFC 8628 sources linked | Pass |

### Phase 23: Auth And Billing Plan Review
- **Status:** review complete; first API auth remediation slice is tracked in Phase 24
- Actions taken:
  - Spawned three parallel subagents to review auth implementation fit, billing/Stripe sequencing, and planning consistency.
  - Performed a local review of auth/billing plans, current API schema, current API auth, control-plane tenancy, CLI auth, and planning index state.
  - Consolidated findings into a dedicated review document.
  - Identified blocking issues around workspace tenancy, static key fallback, webhook idempotency, auth schema duplication, MCP identity propagation, CLI workspace semantics, subscription lifecycle mapping, and test infrastructure.
- Files created/modified:
  - `plans/23-auth-billing-plan-review.md`
  - `plans/README.md`
  - `task_plan.md`
  - `progress.md`

## Latest Auth/Billing Plan Review Verification Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Subagent dispatch | Multiple independent reviews run in parallel | Auth, billing, and planning consistency subagents completed | Pass |
| Review artifact | Consolidated review exists | `plans/23-auth-billing-plan-review.md` added | Pass |
| Findings order | Blocking issues are prioritized | Critical findings lead the review | Pass |
| Remediation order | Next implementation sequence is explicit | Review doc includes docs cleanup, auth implementation, portal auth, billing implementation, and verification order | Pass |

### Phase 24: Auth Implementation Phase A/B API Slice
- **Status:** first API auth/tenancy slice implemented; billing implementation still blocked by migration, bootstrap, CLI, portal, and test work
- Actions taken:
  - Cleaned the billing plan so billing no longer owns or duplicates auth/account tables.
  - Added API auth/account tables for users, workspaces, memberships, login challenges, sessions, API keys, device codes, and audit events.
  - Added bootstrap `usr_internal` and `ws_internal` records for the temporary static-key path.
  - Added D1-backed API-key resolution with hashed keys, scopes, expiry/revocation checks, and `last_used_at` updates.
  - Mapped static env bearer keys and auth-disabled mode to the internal bootstrap workspace only.
  - Added `workspace_id` to control-plane schema tables and included workspace IDs in API responses.
  - Scoped project, deployment, artifact, route, resource, and log read/write queries by workspace.
  - Passed request identity through HTTP deployment routes and MCP tool calls.
  - Added custom-domain conflict handling so a hostname owned by another workspace is not silently reassigned.
- Files created/modified:
  - `../api/schema.sql`
  - `../api/src/auth.ts`
  - `../api/src/control-plane.ts`
  - `../api/src/index.ts`
  - `../api/src/mcp.ts`
  - `plans/22-product-billing-cli-admin-portal.md`
  - `task_plan.md`
  - `progress.md`

## Latest Auth Implementation Verification Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm typecheck` in `../api` | API Worker/MCP typecheck passes | Passed | Pass |
| `pnpm db:init` in `../api` | Fresh local D1 schema applies | 43 SQL commands executed successfully | Pass |
| Sandbox note | Wrangler local D1 needs socket/log permissions | First sandboxed run failed with `EROFS`/`EPERM`; escalated rerun passed | Pass |
| Wrangler local API smoke | Auth and deployment routes work against local D1 | `/health` 200, unauthenticated `/auth/status` 401, D1 API key `/auth/status` 200, `POST /deployments/preview` 201, status/logs 200, MCP `get_deployment_status` 200 | Pass |
| Cross-workspace isolation smoke | A second workspace key cannot read the first workspace deployment | Second key authenticated as `ws_other_smoke`; first workspace deployment returned 404 | Pass |

## Remaining Auth Implementation Gaps
- ✅ Remote D1 migration/backfill: `api/migrations/0001_auth_workspace.sql` ALTERs all 6 control-plane tables with `workspace_id DEFAULT 'ws_internal'`; `db:migrate:remote` script added.
- ✅ First-owner/API-key bootstrap: `api/scripts/bootstrap-owner.js` (`pnpm bootstrap:owner[:remote]`) creates owner+workspace+key, prints raw key once, stores hash only.
- ✅ Portal session login/logout + cookie hardening (API): passwordless email-code sessions (`auth-flow.ts`/`portal.ts`), `httpOnly+secure+SameSite=Lax` session cookie, CORS origin allowlist. (SvelteKit API-key management UI still pending.)
- ✅ CLI profile/workspace/key-management — already shipped in `packages/cli` (NOT `apps/cli`): `auth login` device-code flow (poll + slow_down/authorization_pending), `auth login --api-key`, `auth status`/`whoami`/`logout`, token persisted to `~/.microservices/config.json`.
- ✅ Cross-workspace isolation tests: function-level (`api/test/isolation.test.mjs`) **and** HTTP/MCP-level (`api/test/routes.test.mjs`) — 22 tests via `app.fetch`.
- ❌ Only remaining auth item: SvelteKit portal API-key management UI (frontend).

## Session: 2026-06-14 (auth gap #1 — isolation tests)
### Phase 24 follow-up: cross-workspace isolation test harness
- **Status:** function-level isolation tests complete; CLI auth + route/MCP tests remain
- Verified another agent already shipped remote migration, bootstrap-owner, and portal/session API; corrected stale plan status (and confirmed `create-microservices-app` is already published to npm at 0.2.2).
- Added a zero-extra-runtime D1 test adapter over `node:sqlite` (`api/test/d1.mjs`) implementing the prepare/bind/first/all/run/exec subset the code uses.
- Added `api/test/isolation.test.mjs`: seeds two workspaces+keys, runs the real `resolveRequestIdentity` and control-plane reads.
- Added `vitest` devDep and `test`/`test:watch` scripts to `api/package.json`.

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm test` in `api` | Isolation suite passes | 11/11 passed (1 file) | Pass |
| Identity resolution | Each key → own workspace; unknown/revoked/expired → null | Passed | Pass |
| Control-plane tenancy | ws_b cannot read ws_a project/deployment/artifact/resources/logs; contextless defaults to ws_internal | Passed | Pass |

### Phase 24 follow-up 2: HTTP-route + MCP-level isolation tests
- **Status:** complete; CLI auth confirmed already shipped (drift); only portal key UI remains
- Added `api/test/routes.test.mjs` driving the real Hono app via `app.fetch` and the JSON-RPC `/mcp` surface.
- Extracted shared `api/test/seed.mjs` (workspace + hashed-key seeding) used by both suites.

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm test` in `api` | Both suites pass | 22/22 passed (2 files) | Pass |
| HTTP auth gate | Unauthenticated / unknown bearer → 401 | Passed | Pass |
| HTTP route tenancy | ws_b → 404 on ws_a deployment/project/artifact/resources; empty logs; ws_a → 200 | Passed | Pass |
| MCP identity | ws_a tool call succeeds; ws_b call misses (NOT_FOUND/isError); no token → 401 | Passed | Pass |

## Session: 2026-06-15 (agentic Cloudflare migration prompt orchestrator)
### Phase 25 kickoff
- **Status:** complete
- Goal: add deterministic CLI support for existing-project Cloudflare migration analysis without embedding AI service calls.
- Product decision: CLI generates checklist/prompt files, validates external `report.json`, renders doctor output, and generates staged next-agent prompts.
- Initial target surface: global `packages/cli`, not generated booking template CLI.
- Implemented `microservices analyze <project-dir> --target cloudflare --agent`, `microservices analyze checklist`, `microservices analyze report`, `microservices doctor --from-report`, and `microservices prompt next --from-report`.
- Added package CLI tests for the complete handoff loop and schema rejection for warning findings without evidence.

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm --filter @microservices-sh/cli build` | CLI syntax passes | Passed | Pass |
| `pnpm --filter @microservices-sh/cli test` | CLI tests pass | 5/5 tests passed | Pass |
| `git diff --check` | No whitespace errors | Passed with no output | Pass |

## Session: 2026-06-18 (standalone MCP package and directory distribution)
### Phase 30 kickoff
- **Status:** complete for package, npm, GitHub, official MCP Registry, Docker, and PR-based directories.
- Created and pushed standalone public repo `https://github.com/microservices-sh/mcp`.
- Published `@microservices-sh/mcp@0.1.1` to npm with the package binary `microservices-mcp` and MCP name `sh.microservices/mcp`.
- Added Trusted Publisher publish workflow, reran the release after npm propagation lag, and confirmed the workflow passed.
- Updated MCP package defaults and README examples to use `https://api.microservices.sh`.
- Validated `server.json` with `mcp-publisher validate server.json`.
- Opened listing PRs:
  - Awesome MCP Servers: `https://github.com/punkpeye/awesome-mcp-servers/pull/8249`
  - MCPFind: `https://github.com/MCPFind/mcp-find/pull/77`
  - MCPSvr: `https://github.com/nanbingxyz/mcpsvr/pull/33`
  - Docker MCP Registry: `https://github.com/docker/mcp-registry/pull/3961`
- Published `sh.microservices/mcp@0.1.1` to the official MCP Registry after adding DNS TXT authentication for `microservices.sh`.
- Confirmed Smithery submission needs the correct `microservices` namespace/account; the current CLI session is authenticated under `favcrm`.
- Aligned the root CLI deploy API default and help examples with `https://api.microservices.sh` so generated-app and standalone MCP docs do not contradict the root CLI.

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| npm package | Latest package is available | `@microservices-sh/mcp@0.1.1` is latest | Pass |
| MCP registry metadata | `server.json` validates | `mcp-publisher validate server.json` passed in standalone MCP repo | Pass |
| Docker listing | Remote server entry validates locally | `go run ./cmd/validate -name microservices-sh` passed in Docker registry checkout | Pass |
| MCP endpoint | Hosted endpoint is reachable | `https://api.microservices.sh/mcp` returned MCP metadata | Pass |
| Official registry publish | Registry accepts package | `sh.microservices/mcp@0.1.1` is active and searchable | Pass |

## Session: 2026-06-18 (DOT AI OS agentic operator work)
### Phase 33 kickoff
- **Status:** in progress
- Goal: turn DOT AI OS from a static operator-work UI into an agent-readable, module-owned tasks/focus/review workflow with explicit use cases.
- Scope decision: implement durable local module boundaries for tasks, focus blocks, and review drafts first; keep provider writes, AI calls, knowledge ingestion, and publishing behind future approval-gated modules.
- Working-tree note: unrelated dirty changes exist in promotion docs, email/forms-intake/workspace-tools/company/ERP files. Keep this phase isolated to the new module, `dot-ai-os`, and planning metadata unless verification requires otherwise.

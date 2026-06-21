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

## Session: 2026-06-20

### Phase 41: Product Roadmap Status Audit
- **Status:** complete
- Actions taken:
  - Audited `plans/29-lp-marketing-product-roadmap.md` one by one against current repo evidence.
  - Reconciled the newer product roadmap with the older `plans/03-development-roadmap.md`.
  - Verified create package behavior, template specs, module registry counts, project shim sync, root CLI drift, and video asset consistency.
  - Isolated the full spec failure to `modules/marketing-research`.
  - Fixed the booking module spec policy so it checks the current Drizzle interval-overlap implementation.
  - Fixed the create package help/version display so it reads `package.json` and prints `0.4.3` instead of stale `0.2.6`.
  - Added a dedicated status audit document that marks each roadmap item as done, mostly done, partial, open, or not verifiable.
- Files created/modified:
  - `plans/30-product-roadmap-status-audit.md`
  - `plans/README.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `modules/booking/microservices.check.mjs`
  - `packages/create-microservices-app/src/index.js`

## Latest Product Roadmap Verification Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm --filter create-microservices-app start -- --help` | Help prints current package version | Printed `create-microservices-app 0.4.3` | Pass |
| `pnpm --filter create-microservices-app test` | Create package tests pass | 15/15 passed | Pass |
| `pnpm --filter create-microservices-app smoke` | Pack/generate/project CLI smoke passes | Passed; framework smoke skipped unless `--network` | Pass |
| `pnpm --filter @microservices-sh/booking build` | Booking module typecheck passes | Passed | Pass |
| `pnpm --filter @microservices-sh/booking test` | Booking module tests pass | 6 files / 41 tests passed | Pass |
| `pnpm --filter @microservices-sh/template-booking-sveltekit check:spec` | Booking template spec passes | Passed | Pass |
| `pnpm --filter @microservices-sh/template-client-portal-sveltekit check:spec` | Client portal template spec passes | Passed | Pass |
| `pnpm --filter @microservices-sh/template-erp-shell-sveltekit check:spec` | ERP shell template spec passes | Passed | Pass |
| `node packages/workspace-tools/src/index.js registry build --out /tmp/ms-roadmap-registry --json` | Registry build succeeds | Passed; 28 modules and 7 templates | Pass |
| `node packages/workspace-tools/src/index.js shims check --json` | Project shims are in sync | Passed | Pass |
| Per-module spec loop | Identify broad spec blocker | Only `modules/marketing-research` failed | Pass |
| `pnpm spec:check:all` | Full spec suite passes | Initially failed on `modules/marketing-research`; resolved in Phase 43/44 | Resolved |

### Phase 42: Launch Docs, CLI Boundary, Quickstart Proof, And Pilot Boundary
- **Status:** complete
- Actions taken:
  - Updated root and package README positioning to `microservices.sh System Harness`.
  - Updated `templates/README.md` to list all 7 current templates and mark `dot-ai-os` as draft/private pilot.
  - Added `docs/system-harness.md` with the canonical product definition, public workflow, CLI boundary, deploy-language guardrails, and operator-pilot boundary.
  - Added `docs/operator-pilot-boundary.md` to keep Agent Center, Hermes, and Ads Manager private-pilot/demo until runtime, audit, approval, billing, and provider-write gates are met; Marketing Research now stays public only with approval-gated provider actions.
  - Added `docs/quickstart-proof.md` with exact clean quickstart commands, timing, and results.
  - Updated `docs/llms.txt` so agents start with `booking-sveltekit` and the generated project CLI instead of the old root-CLI/`booking-business` precursor flow.
  - Updated launch copy to say preview-deploy planning tools instead of preview deployment tools.
  - Ran a clean quickstart from a packed `create-microservices-app@0.4.3` artifact under `/tmp`.
- Files created/modified:
  - `README.md`
  - `packages/create-microservices-app/README.md`
  - `templates/README.md`
  - `docs/system-harness.md`
  - `docs/operator-pilot-boundary.md`
  - `docs/quickstart-proof.md`
  - `docs/llms.txt`
  - `docs/promotion/launch-copy.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

## Latest Launch Docs And Quickstart Verification Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Packed create artifact quickstart | Generate default `booking-sveltekit` outside workspace and run first check | Passed from `/tmp/ms-clean-quickstart-20260620-024358`; time to first check 2.69s | Pass |
| Generated app `pnpm install --offline` | Install without network if cache is warm | Failed because `@cloudflare/workers-types` was absent from local store | Expected on cold cache |
| Generated app `pnpm install` | Fresh install with registry access succeeds | Passed in 12.3s | Pass |
| Generated app `pnpm microservices check --json` after install | App-local checks pass | Passed | Pass |
| Generated app `pnpm microservices modules list --json` | Module contracts are readable | Passed | Pass |
| Generated app `pnpm microservices add payment --plan --json` | Approval/plan-only path returns without writing files | Passed with plan-only warning | Pass |
| `pnpm --filter create-microservices-app test` | Create package tests still pass after docs/version changes | 15/15 passed | Pass |
| `pnpm --filter @microservices-sh/template-booking-sveltekit check:spec` | Default template spec still passes | Passed | Pass |
| `git diff --check` | No whitespace errors | Passed | Pass |

### Phase 43: Marketing Research Module Contract Completion
- **Status:** complete
- Actions taken:
  - Verified the `marketing-research` TypeScript implementation already built successfully.
  - Confirmed `marketing-research` failed the module checker only because required contract/docs/schema files and required exports were missing.
  - Added standard module docs: `README.md`, `README.agent.md`, `llms.txt`.
  - Added OpenAPI, JSON schemas, D1 migration, and package-specific policy checks.
  - Added required TypeScript concern exports under `src/types.ts`, `src/schemas.ts`, `src/hooks.ts`, `src/manifest`, `src/config`, `src/schema`, `src/events`, `src/permissions`, `src/resources`, `src/service`, and `src/ports`.
  - Updated `package.json` exports to the standard module surface.
  - Updated roadmap/operator docs so Marketing Research is no longer a spec blocker; provider/runtime actions remain approval-gated until proof exists.
- Files created/modified:
  - `modules/marketing-research/README.md`
  - `modules/marketing-research/README.agent.md`
  - `modules/marketing-research/llms.txt`
  - `modules/marketing-research/openapi.json`
  - `modules/marketing-research/migrations/0001_marketing_research.sql`
  - `modules/marketing-research/microservices.check.mjs`
  - `modules/marketing-research/package.json`
  - `modules/marketing-research/schemas/`
  - `modules/marketing-research/src/types.ts`
  - `modules/marketing-research/src/schemas.ts`
  - `modules/marketing-research/src/hooks.ts`
  - `modules/marketing-research/src/manifest/index.ts`
  - `modules/marketing-research/src/config/index.ts`
  - `modules/marketing-research/src/schema/index.ts`
  - `modules/marketing-research/src/hooks/index.ts`
  - `modules/marketing-research/src/events/index.ts`
  - `modules/marketing-research/src/permissions/index.ts`
  - `modules/marketing-research/src/resources/index.ts`
  - `modules/marketing-research/src/service/index.ts`
  - `modules/marketing-research/src/ports/index.ts`
  - `plans/30-product-roadmap-status-audit.md`
  - `docs/operator-pilot-boundary.md`
  - `findings.md`
  - `task_plan.md`
  - `progress.md`

## Latest Marketing Research Verification Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm --filter @microservices-sh/marketing-research build` | Module typecheck passes | Passed | Pass |
| `pnpm --filter @microservices-sh/marketing-research check:spec` | Marketing Research module contract passes | Passed | Pass |
| `pnpm --filter @microservices-sh/marketing-research test` | Existing test script/status does not fail | Passed/no output | Pass |

### Phase 44: Marketing Research Publish-Ready Metadata
- **Status:** complete
- Completed:
  - Marked `marketing-research` as `available` in `module.json` and the exported manifest.
  - Added admin reference UI metadata and `skills/marketing-research-operator/SKILL.md`.
  - Updated roadmap/operator docs to position it as governed cited research with approval-gated external fetch and AI-provider actions.

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm --filter @microservices-sh/marketing-research build` | Module typecheck still passes after metadata changes | Passed | Pass |
| `pnpm --filter @microservices-sh/marketing-research check:spec` | Module contract still passes after metadata changes | Passed | Pass |
| `pnpm spec:check:all` | Full workspace spec is no longer blocked | Passed; 28 modules and 7 templates, 35 targets | Pass |
| `node packages/workspace-tools/src/index.js registry build --out /tmp/ms-publish-registry --json` | Registry build includes publishable module metadata | Passed; `marketing-research` is `available` with skill and approval metadata | Pass |
| `git diff --check` | No whitespace errors | Passed | Pass |

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
- **Status:** complete
- Goal: turn DOT AI OS from a static operator-work UI into an agent-readable, module-owned tasks/focus/review workflow with explicit use cases.
- Scope decision: implement durable local module boundaries for tasks, focus blocks, and review drafts first; keep provider writes, AI calls, knowledge ingestion, and publishing behind future approval-gated modules.
- Working-tree note: unrelated dirty changes exist in promotion docs, email/forms-intake/workspace-tools/company/ERP files. Keep this phase isolated to the new module, `dot-ai-os`, and planning metadata unless verification requires otherwise.
- Implemented `@microservices-sh/operator-work` with D1 and memory stores, schemas, hooks, events, ports, use cases, and module docs.
- Wired DOT AI OS workbench/tasks/focus/review routes through the operator-work module; write actions record actor/source and audit events.
- Updated create CLI bundling so generated `dot-ai-os` apps include `modules/operator-work`.

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm --filter @microservices-sh/operator-work build` | Module TypeScript passes | Passed | Pass |
| `pnpm --filter @microservices-sh/operator-work check:spec` | Module spec passes | Passed | Pass |
| `pnpm spec:check -- template templates/dot-ai-os` | Template spec passes | Passed | Pass |
| `pnpm --filter @microservices-sh/template-dot-ai-os build:app` | SvelteKit build passes | Passed | Pass |
| `pnpm --filter create-microservices-app test` | Create CLI tests pass | 15/15 passed | Pass |
| `git diff --check` | No whitespace errors | Passed with no output | Pass |

## Session: 2026-06-18 (agentic admin and visitor template review)
### Phase 34 kickoff
- **Status:** in progress
- Goal: make ready templates support real agentic/admin management and visitor/customer use where applicable.
- Initial review findings: SaaS starter login used demo sessions despite ready status; client portal production login was disabled; client portal file listing was tenant-wide; WordPress/EmDash workspace build was flaky in the Cloudflare Vite plugin.
- Implemented so far: started replacing SaaS starter auth with `identity`, `email`, and gateway rate-limit modules; added login API, email dependencies, identity/email migrations, session helpers, and tests/docs/spec updates.

### Phase 34 update: SaaS starter auth fixed
- Replaced demo email/session login with identity-owned passwordless email-code login, session reads, logout, signup bootstrap, and admin allowlist handling.
- Added identity/email module dependencies, migrations, docs, lockfile metadata, and spec assertions.
- Cleaned stale auth wording in the ads helper.

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm --filter @microservices-sh/template-saas-starter-sveltekit check:spec` | Template spec passes | Passed | Pass |
| `pnpm --filter @microservices-sh/template-saas-starter-sveltekit test` | SaaS starter flow tests pass | 2/2 tests passed | Pass |
| `pnpm --filter @microservices-sh/template-saas-starter-sveltekit build:app` | SvelteKit build passes | Passed | Pass |

### Phase 34 update: client portal auth and file scoping fixed
- Replaced the production-disabled client portal login path with identity/email passwordless login.
- Staff login is constrained to `ADMIN_EMAILS`; customer login codes are issued only for existing customer emails.
- Added logout, identity/email migrations, gateway rate-limiting, session helpers, and docs/spec assertions.
- Extended `@microservices-sh/file-media` with optional `ownerId` on tickets/files and list filtering.
- Updated client portal dashboard/files routes and demo seeding to pass `customerId` as file-media `ownerId`.

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm --filter @microservices-sh/file-media build` | File-media TypeScript passes | Passed | Pass |
| `pnpm --filter @microservices-sh/file-media check:spec` | File-media module spec passes | Passed | Pass |
| `pnpm exec vitest run modules/file-media/src/file-media.test.ts modules/file-media/tests/connections.test.ts` | File-media tests pass including owner scoping | 17/17 passed | Pass |
| `pnpm --filter @microservices-sh/template-client-portal-sveltekit check:spec` | Client portal spec passes | Passed | Pass |
| `pnpm --filter @microservices-sh/template-client-portal-sveltekit build:app` | Client portal SvelteKit build passes | Passed | Pass |

### Phase 34 update: WordPress/EmDash focused checks fixed
- Set the Astro Cloudflare adapter to `inspectorPort: false` to avoid the Cloudflare Vite plugin probing local network interfaces for a debug inspector during production builds.
- Fixed a WordPress probe test deadlock by changing the local-server probe case from synchronous child process spawning to async spawning; `spawnSync` blocked the test HTTP server event loop.

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm --filter wordpress-emdash-blog-astro check:spec` | Template spec passes | Passed | Pass |
| `pnpm --filter wordpress-emdash-blog-astro build` | Astro/Cloudflare build passes | Passed | Pass |
| `pnpm --filter wordpress-emdash-blog-astro test:cli` | Migration CLI tests pass | 4/4 passed | Pass |

### Phase 34 final verification
- Rebuilt `create-microservices-app` after updating source templates and module bundle lists, so generated SaaS/client-portal apps include identity, email, gateway, and the owner-scoped file-media module.
- Full spec checks, full Vitest suite, and recursive workspace build now pass.
- Note: sandboxed recursive build failed once with `listen EPERM 127.0.0.1`; rerunning with local loopback permission passed. This is required by the Astro/Cloudflare build internals.

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm --dir packages/create-microservices-app build` | Create package rebuilds bundled templates | Passed | Pass |
| `pnpm --filter create-microservices-app test` | Create package tests pass | 15/15 passed | Pass |
| `pnpm spec:check:all` | All module/template specs pass | 30/30 targets passed | Pass |
| `pnpm test` | Full workspace Vitest suite passes | 71 files / 405 tests passed | Pass |
| `pnpm -r --workspace-concurrency=1 build` | Recursive workspace build passes | Passed with local loopback permission | Pass |
| `git diff --check` | No whitespace errors | Passed | Pass |

## Session: 2026-06-18 (DOT AI OS operator-work agentic catalog)
### Phase 35 kickoff
- **Status:** complete
- Goal: make the `operator-work` module discoverable as an agentic tool surface, not only as template-local implementation code.
- Added complete operator-work read tools to module metadata: workbench, tasks, focus blocks, and daily reviews.
- Marked task, focus-block, and daily-review writes as approval-required in module metadata and operator skill guidance.
- Added operator-work to the central module-contract catalog with permissions, RPC methods, hooks, events, runtime mount, and admin/agentic surfaces.
- Extended SDK module docs to include declared surfaces so generated docs list agentic tools and write approval gates.
- Updated the bundled `dot-ai-os` create-app template copy of the operator-work metadata, skill, and reference UI docs.

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm --filter @microservices-sh/module-contract build` | Module contract package builds | Passed | Pass |
| `pnpm test -- packages/module-contract/tests/module-versioning.test.js packages/sdk-internal/tests/module-versioning.test.js` | Module contract and SDK doc tests pass | Vitest ran the full workspace suite: 71 files / 410 tests passed | Pass |
| `pnpm --filter @microservices-sh/operator-work check:spec` | Operator-work module spec passes | Passed | Pass |
| `pnpm --filter @microservices-sh/operator-work build` | Operator-work module build passes | Passed | Pass |

## Session: 2026-06-18 (workspace module surface discovery)
### Phase 36 kickoff
- **Status:** complete
- Goal: make admin, visitor, and agentic module surfaces discoverable from workspace registry/discovery output.
- Added surface declarations to checked-in module manifests and paired each module with lightweight `reference-ui/README.md` and `skills/*/SKILL.md` files.
- Extended workspace-tools to normalize `surfaces`, validate referenced UI/skill files, include `referenceUi` and `skillFiles` in registry entries, and copy surface data into generated-app discovery output.
- Added tests for surface normalization and checked-in module surface coverage.
- Note: one discovery/check probe used obsolete positional syntax and returned `Unknown check scope`; reran with `discover --path ...` and `check module ...` successfully.

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm spec:check:all` | All module/template specs pass with surface file checks | 30/30 targets passed | Pass |
| `pnpm exec vitest run packages/workspace-tools/tests/connections.test.js` | Workspace-tools connection/surface tests pass | 10/10 tests passed | Pass |
| `pnpm --filter @microservices-sh/workspace-tools build` | Workspace-tools syntax check passes | Passed | Pass |
| `node packages/workspace-tools/src/index.js registry build --out /tmp/ms-registry-surface-check --json` | Registry build includes module surfaces | Passed; 23 modules / 7 templates | Pass |
| `node packages/workspace-tools/src/index.js discover --path templates/dot-ai-os --json` | Discovery exposes installed module surfaces | Passed; output includes `surfaces`, `referenceUi`, and `skillFiles` for installed modules | Pass |
| `node packages/workspace-tools/src/index.js check module modules/auth --json` | Single module check validates surface paths | Passed | Pass |

## Session: 2026-06-19 (Corporate OS create-app onboarding)
### Phase 37 kickoff
- **Status:** complete
- Goal: make `dot-ai-os` easier to create as a company-specific Corporate OS with durable intake context.
- Added `--os` / `--corporate-os` mode to default create-app to `dot-ai-os`.
- Added `--os-intake` JSON and interactive intake prompts for company profile, owner, operating loop, first workflow, research sources, recurring decisions, approval rules, and pilot metric.
- Generated `microservices.os.json` plus `docs/company-model.md`, `docs/operating-map.md`, `docs/research-sources.md`, `docs/decision-briefs.md`, and `docs/pilot-plan.md`.
- Updated README guidance and create-package smoke coverage for Corporate OS generation.
- Rebuilt the create package bundle; generated template copies are ignored by Git and not committed directly.

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm --dir packages/create-microservices-app build` | Create package bundle and syntax check pass | Passed | Pass |
| `node --check packages/create-microservices-app/src/index.js` | Source syntax passes | Passed | Pass |
| `pnpm --filter create-microservices-app test` | Create package unit tests pass | 15/15 tests passed | Pass |
| `pnpm --filter create-microservices-app smoke` | Packed create package generates standard and Corporate OS apps | Passed | Pass |

## Session: 2026-06-19 (admin CLI dogfooding and remote-API profile)
### Phase 38 consolidation
- **Status:** complete
- Goal: make the existing `admin/` app dogfood the workspace CLI contract while preserving its role as a hosted-API control-plane portal, not a local ERP/D1-owned app.
- Added admin contract files, local CLI script, smoke script, API-boundary docs, `wrangler.jsonc`, and package scripts so `npm run dev`, local setup, smoke, and deploy planning use the CLI path.
- Upstreamed the remote-API/control-plane profile into the shared SvelteKit shim so future generated apps can opt in through `appProfile.remoteApi` or `appProfile.kind = "control-plane"`.
- Synced generated shims into SvelteKit templates and `create-microservices-app`; hardened deployment module ID normalization.
- Clarified migration wording: remote-API apps skip app-local D1 migrations because they own no local migrations.

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `pnpm --dir admin check` | Admin Svelte diagnostics pass | 0 errors / 0 warnings | Pass |
| `pnpm --dir admin build` | Admin Cloudflare build passes | Passed | Pass |
| `node admin/scripts/microservices.js check --json` | Admin CLI contract checks pass | Passed | Pass |
| `node admin/scripts/microservices.js local migrate --json` | Admin local migration skips | Skipped with remote-API reason | Pass |
| `node admin/scripts/microservices.js deploy preview --plan --json` | Admin deploy plan uses control-plane profile | Modules: `admin-shell`; no app-owned D1 migration | Pass |
| `pnpm check:shims -- --json` | Generated shims stay synced | Passed | Pass |
| `pnpm --filter create-microservices-app smoke` | Create package smoke keeps default and profile-aware shims working | Passed | Pass |

## Session: 2026-06-20 (marketing skills validation and competitor positioning)
### Phase 39 validation
- **Status:** complete
- Goal: use available marketing skills and repo-local product skills to validate competitor research, production positioning, ICP persona, and product-development priorities.
- Confirmed the project-local `./.agents/` directory is empty and no `.agents/product-marketing.md` exists; used installed `social` and `paid-ads` skills plus repo-local `skills/microservices-*` and `modules/ads-manager/skills/ads-manager-operator`.
- Re-checked current official/category sources for Lovable, Bolt, Replit Agent, v0, Supabase, Firebase, Cloudflare Agents, Composio, Stack Overflow Developer Survey 2025, and HN Show HN rules.
- Verified `@microservices-sh/mcp` current npm version is `0.1.3`; the official MCP Registry API also reports version `0.1.3` as `isLatest: true`.
- Updated `findings.md` with the validated recommendation: lead publicly with "Production foundations for AI-built Cloudflare apps" and use "microservices.sh System Harness" as the explanatory category for a contract-driven environment for agent-built apps.
- Revised ICP: primary is AI-heavy technical founders, agencies, fractional CTOs, and Cloudflare-oriented developers; business operators remain a pilot lane until Hermes/Agent Center/research approvals are end-to-end.
- Product priority: prove one no-handwaving workflow from create-app to contracts/checks/risk gate/deploy plan before adding more broad modules or paid ads.
- Noted launch blockers: stale MCP version/duration labels in non-HyperFrames video previews and Hermes docs still need hosted-vs-BYO clarity. Marketing Research has since moved from `draft` to available, while external/AI actions remain approval-gated.

| Check | Expected | Actual | Status |
|------|----------|--------|--------|
| Local skill audit | Find requested `./.agents/skills` or fallback | `./.agents/` empty; installed and repo-local skills used | Pass |
| Current source review | Validate competitor/category claims against current sources | Official/current pages checked and recorded in `findings.md` | Pass |
| Planning files | Track phase and findings | `task_plan.md`, `progress.md`, and `findings.md` updated | Pass |

## Session: 2026-06-20 (landing page content and roadmap)
### Phase 40 audit and revision
- **Status:** complete
- Goal: audit and revise the landing-page content for the `microservices.sh System Harness` direction, then capture a marketing strategy and product roadmap.
- Updated the landing page hero, problem, solution, quickstart, agency, mission, and final CTA copy to lead with production foundations, contracts, checks, lockfiles, approval gates, and source-visible Cloudflare modules.
- Updated adjacent marketing pages in the landing repo: agency page, quickstart page, pricing page, compare index, writing index, footer, nav CTA, and README messaging guardrails.
- Fixed shared nav CTA anchors from `#quickstart` to `/#quickstart` so secondary pages route to the home quickstart section.
- Added `plans/29-lp-marketing-product-roadmap.md` with LP audit findings, revised positioning stack, marketing strategy, channel plan, content pillars, and product roadmap.
- Updated planning index and findings to point at the new plan.

| Check | Expected | Actual | Status |
|------|----------|--------|--------|
| LP content audit | Copy aligns around System Harness, not MCP/package-only positioning | Core pages patched in the landing-page repo | Pass |
| Strategy artifact | Marketing strategy and product roadmap captured | Added `plans/29-lp-marketing-product-roadmap.md` | Pass |
| Build validation | Landing build and whitespace checks pass | `pnpm build`, landing `git diff --check`, and planning-doc `git diff --check` passed | Pass |

## Session: 2026-06-21 (StackSuite accounting and commerce templates)
### Phase 45 template split
- **Status:** verified
- Goal: turn the StackSuite accounting/commerce module extraction into create-app-visible repo templates.
- Used subagents for parallel template directory starts, then closed them after partial/racy output and integrated the final version in the main thread.
- Added `commerce-ops-sveltekit` and `accounting-erp-sveltekit` from the ERP shell with focused manifests, lockfiles, enabled-module sets, StackSuite-specific docs, and unique package/template ids.
- Registered both templates in create-app template discovery and bundle metadata.
- Recorded the remaining technical boundary: route-level StackSuite pages are now available, but inherited shell deps remain broad until shared dashboard/store imports are narrowed.

| Check | Expected | Actual | Status |
|------|----------|--------|--------|
| Template specs | New templates pass shared template validation | `pnpm --filter @microservices-sh/template-commerce-ops-sveltekit check:spec`; `pnpm --filter @microservices-sh/template-accounting-erp-sveltekit check:spec` | Pass |
| Create-app tests | Registry and bundle closure stay green | `pnpm --filter create-microservices-app test`; `pnpm exec vitest run packages/create-microservices-app/tests/template-bundle-closure.test.js` | Pass |
| Create-app build | Bundled templates include new template ids | `pnpm --filter create-microservices-app build` | Pass |
| Create-app smoke | New templates generate standalone source trees | Both templates generated under `/tmp` with `--no-install --no-git`; commerce output includes `0006_support_ticket.sql` | Pass |
| Full spec | Workspace module/template checks pass | `pnpm spec:check:all` passed 51 targets | Pass |

### Phase 46 StackSuite route adoption

- Goal: make the focused commerce and accounting templates use StackSuite modules as first-class app routes instead of only listing them in metadata.
- Wired `product-catalog`, `inventory`, `sales-order`, and `shipment` stores into the commerce template request locals for both D1 and memory adapters.
- Added `/app/products` with module-backed product listing/creation, RBAC gating, module gating, and audit events.
- Added `/app/inventory` with product-joined stock balances, recent stock movements, receive-stock action, inventory product validation, and audit events.
- Added `/app/sales-orders` with customer-backed draft order creation, order confirmation, issued-invoice handoff, and order ledger review.
- Added `/app/shipments` with ready sales-order batch creation, fulfillment item review, and idempotent shipment completion that deducts tracked stock through the inventory module.
- Added `/app/commerce-sync` with read-only connection, sync-run, mapping, and webhook receipt contract review.
- Wired `accounting-core` and `accounts-payable` stores into the accounting template request locals for both D1 and memory adapters.
- Added `/app/ledger` with chart-of-accounts listing and account creation.
- Added `/app/payables` with vendor creation, bill creation, bill ledger, and AP aging metrics.
- Added `/app/receivables` with AR aging and open receivable contract review.
- Added `/app/banking` with bank account, statement transaction, and reconciliation contract review.
- Added commerce/accounting sidebar navigation and icon support for the new route groups.
- Extended local demo seeding with three commerce products, opening stock movements, one confirmed sales order, and commerce-sync demo records so fresh dev sessions show usable module data.
- Declared missing inherited workspace dependencies in `templates/commerce-ops-sveltekit/package.json` so the focused template builds from its own package boundary.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Commerce build | SvelteKit/Cloudflare production build passes | `pnpm --filter @microservices-sh/template-commerce-ops-sveltekit build` passed; invoice detail state warning fixed | Pass |
| Commerce spec | Shared template checks pass | `pnpm --filter @microservices-sh/template-commerce-ops-sveltekit check:spec` passed | Pass |
| Accounting build | SvelteKit/Cloudflare production build passes | `pnpm --filter @microservices-sh/template-accounting-erp-sveltekit build` passed; existing invoice detail Svelte warning remains non-blocking | Pass |
| Accounting spec | Shared template checks pass | `pnpm --filter @microservices-sh/template-accounting-erp-sveltekit check:spec` passed | Pass |
| Create-app build | Bundled templates rebuild after source/package changes | `pnpm --filter create-microservices-app build` passed | Pass |
| Create-app tests | Registry and create-package unit tests pass | `pnpm --filter create-microservices-app test` passed, 19/19 | Pass |
| Bundle closure | Generated template module graph remains closed | `pnpm exec vitest run packages/create-microservices-app/tests/template-bundle-closure.test.js` passed, 22/22 | Pass |
| Generated route smoke | Generated templates contain new route files | Both templates generated under `/tmp`; route files verified with `rg` | Pass |
| Full spec | Workspace module/template checks pass | `pnpm spec:check:all` passed, 51 targets | Pass |

### Phase 47 StackSuite durable adapter readiness

- **Status:** complete for service ports and memory adapters; bank D1 adapter ready; AR/commerce D1 blocked on table contracts.
- Goal: make the service-style StackSuite modules usable from durable stores instead of only closure-local memory services.
- Added async store-backed service factories for `accounts-receivable`, `bank-reconciliation`, and `commerce-sync`.
- Preserved existing synchronous memory services so current local callers and tests keep working.
- Added memory store adapters for accounts receivable, bank reconciliation, and commerce sync, with store-backed workflow tests.
- Added commerce-sync read APIs for provider mappings, sync runs, and webhook receipts so route adapters can render state without writing demo records during page loads.
- Added `createD1BankReconciliationStore()` mapped to the existing bank reconciliation D1 migration tables.
- Documented why accounts receivable D1 needs an invoice snapshot table and why commerce sync D1 needs a normalized envelope table before those adapters should be added.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Accounts receivable test | Memory and store-backed AR workflows pass | `pnpm --dir modules/accounts-receivable test` passed, 3/3 | Pass |
| Accounts receivable build/spec | Typecheck and module contract pass | `pnpm --dir modules/accounts-receivable build`; `pnpm --dir modules/accounts-receivable check:spec` | Pass |
| Bank reconciliation test | Sync memory and async store-backed reconciliation workflows pass | `pnpm --dir modules/bank-reconciliation test` passed, 2/2 | Pass |
| Bank reconciliation build/spec | Typecheck and module contract pass | `pnpm --dir modules/bank-reconciliation build`; `pnpm --dir modules/bank-reconciliation check:spec` | Pass |
| Commerce sync test | Memory and store-backed sync workflows pass | `pnpm --dir modules/commerce-sync test` passed, 2/2 | Pass |
| Commerce sync build/spec | Typecheck and module contract pass | `pnpm --dir modules/commerce-sync build`; `pnpm --dir modules/commerce-sync check:spec` | Pass |
| Full spec | Workspace module/template checks pass | `pnpm spec:check:all` passed, 51 targets | Pass |
| Whitespace | No diff whitespace errors | `git diff --check` passed | Pass |

### Phase 50 Accounts receivable route write workflow

- **Status:** complete.
- Goal: make the accounting ERP receivables page demonstrate the accounts-receivable module's customer-payment write path, not only AR aging reads.
- Added a manager-gated `recordPayment` action to `/app/receivables` that validates open invoice snapshots, records an idempotent customer payment, applies it to the selected invoice, and records an audit event.
- Added per-invoice payment forms to the receivables page with amount/date inputs, success/error feedback, current customer display fallback, and mobile-safe layout.
- Guarded local demo receivable seeding so development payments are not reset on every page reload.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Accounting template build | SvelteKit/Cloudflare production build passes | `pnpm --filter @microservices-sh/template-accounting-erp-sveltekit build` passed | Pass |
| Accounting template spec | Shared template check passes | `pnpm --filter @microservices-sh/template-accounting-erp-sveltekit check:spec` passed | Pass |
| Accounts receivable module | Build, tests, and spec stay green | `build`, `test` 3/3, and `check:spec` passed | Pass |
| Create-app build | Bundled repo templates rebuild | `pnpm --filter create-microservices-app build` passed | Pass |
| Bundle closure | Generated template module graph remains closed | `pnpm exec vitest run packages/create-microservices-app/tests/template-bundle-closure.test.js` passed, 22/22 | Pass |

### Phase 51 Broader StackSuite app adoption audit

- **Status:** complete.
- Goal: review the remaining StackSuite apps for reusable value beyond the accounting and commerce ports.
- Audited high-signal schemas, migrations, and docs from SMS CRM, DashDrive, booking variants, HelpGrid, HR System, and accounting/invoice variants.
- Identified the next best adoption candidates as modules rather than direct app clones: `sms-campaigns`, support inbox/widget hardening, `membership-credits`, `estimate-quote`/recurring documents, storage entitlements/share links, and HR people ops.
- Captured lower-priority utility candidates: content CMS, URL shortener, QR code, document renderer, video generation, and web builder.
- Added `plans/35-stacksuite-broader-adoption-plan.md` and linked it from the planning index.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Source inventory | Remaining StackSuite domains are reviewed by schema/docs evidence | SMS CRM, DashDrive, booking membership/credits, HelpGrid support/KB/widget, HR, accounting estimates/recurring docs reviewed | Pass |
| Planning artifact | Technical adoption plan is captured in repo | `plans/35-stacksuite-broader-adoption-plan.md` added | Pass |

### Phase 48 Focused template durable service wiring

- **Status:** complete.
- Goal: make the focused StackSuite template pages consume the durable service factories from request locals instead of creating fresh memory services inside each page load.
- Wired `accounting-erp-sveltekit` request locals for `accountsReceivableService` and `bankReconciliationService`.
- Initial wiring used memory-backed accounts receivable and commerce sync services while D1 table contracts were still pending; Phase 49 replaced those with D1-backed services when DB is bound.
- Wired `commerce-ops-sveltekit` request locals for `commerceSyncService` using the persistent store-backed service.
- Updated the receivables, banking, and commerce sync page server loaders to await the async service APIs and reuse existing demo account/connection records where possible.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Accounting template spec | Shared template check passes | `pnpm --dir templates/accounting-erp-sveltekit check:spec` passed | Pass |
| Commerce template spec | Shared template check passes | `pnpm --dir templates/commerce-ops-sveltekit check:spec` passed | Pass |
| Accounting template build | SvelteKit/Cloudflare production build passes | `pnpm --dir templates/accounting-erp-sveltekit build` passed; existing invoice detail Svelte warning remains non-blocking | Pass |
| Commerce template build | SvelteKit/Cloudflare production build passes | `pnpm --dir templates/commerce-ops-sveltekit build` passed; existing invoice detail Svelte warning remains non-blocking | Pass |
| Create-app build | Bundled repo templates rebuild | `pnpm --filter create-microservices-app build` passed | Pass |
| Bundle closure | Generated template module graph remains closed | `pnpm exec vitest run packages/create-microservices-app/tests/template-bundle-closure.test.js` passed, 22/22 | Pass |
| Full spec | Workspace module/template checks pass | `pnpm spec:check:all` passed, 51 targets | Pass |
| Whitespace | No diff whitespace errors | `git diff --check` passed | Pass |

### Phase 49 Accounts receivable and commerce sync D1 completion

- **Status:** complete.
- Goal: close the remaining D1 table-contract gaps for the store-backed StackSuite service modules.
- Added `ar_invoice_snapshots` and `createD1AccountsReceivableStore(db)` for durable AR invoice snapshots, payments, applications, open receivables, aging, and statements.
- Added `commerce_sync_envelopes` and `createD1CommerceSyncStore(db)` for durable commerce connections, mappings, sync runs, webhook receipts, and normalized envelopes.
- Exported both D1 adapters through module roots and package subpaths.
- Updated focused accounting/commerce templates so AR and commerce sync use D1-backed services when `DB` is bound.
- Moved commerce sync demo data into local demo seeding so the commerce sync route reads persisted service state instead of creating records during page load.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Accounts receivable tests | Existing memory and store-backed flows pass | `pnpm --dir modules/accounts-receivable test` passed, 3/3 | Pass |
| Accounts receivable build/spec | Typecheck and module contract pass | `pnpm --dir modules/accounts-receivable build`; `pnpm --dir modules/accounts-receivable check:spec` | Pass |
| Commerce sync tests | Existing memory and store-backed flows pass | `pnpm --dir modules/commerce-sync test` passed, 2/2 | Pass |
| Commerce sync build/spec | Typecheck and module contract pass | `pnpm --dir modules/commerce-sync build`; `pnpm --dir modules/commerce-sync check:spec` | Pass |
| D1 migrations | New module migrations load in SQLite | `sqlite3 :memory: ".read modules/accounts-receivable/migrations/0001_initial.sql"` and commerce-sync equivalent passed | Pass |
| Focused template specs | Accounting and commerce template specs pass | `pnpm --dir templates/accounting-erp-sveltekit check:spec`; `pnpm --dir templates/commerce-ops-sveltekit check:spec` | Pass |
| Focused template builds | Accounting and commerce templates build | Both `pnpm --dir ... build` commands passed; accounting still has the existing invoice detail Svelte warning | Pass |
| Create-app build | Bundled repo templates rebuild | `pnpm --filter create-microservices-app build` passed | Pass |
| Bundle closure | Generated template module graph remains closed | `pnpm exec vitest run packages/create-microservices-app/tests/template-bundle-closure.test.js` passed, 22/22 | Pass |
| Full spec | Workspace module/template checks pass | `pnpm spec:check:all` passed, 51 targets | Pass |
| Whitespace | No diff whitespace errors | `git diff --check` passed | Pass |

### Phase 52 StackSuite SMS Campaigns module

- **Status:** complete.
- Goal: turn the highest-priority remaining StackSuite donor app (`sms-crm`) into a reusable contract-checked module.
- Added `modules/sms-campaigns` with typed service use cases for SMS contacts, groups, templates, provider configuration, campaign creation/scheduling, dispatch, delivery callback recording, and reporting.
- Added memory and D1 stores, a provider port, migration tables for campaign state and delivery logs, package exports, schemas, metadata, permissions, events, resources, and module spec checks.
- Added tests for opt-in recipient filtering, scheduled campaign lookup, provider dispatch, delivery reconciliation, idempotent vendor-message callbacks, and rejection when no recipient has opted in.

| Check | Expectation | Result | Status |
|---|---|---|---|
| SMS module build | TypeScript typecheck passes | `pnpm --filter @microservices-sh/sms-campaigns build` passed | Pass |
| SMS module tests | Campaign lifecycle and guard tests pass | `pnpm --filter @microservices-sh/sms-campaigns test` passed, 3/3 | Pass |
| SMS module spec | Module contract check passes | `pnpm --filter @microservices-sh/sms-campaigns check:spec` passed | Pass |
| D1 migration | Module migration loads in SQLite | `sqlite3 :memory: ".read modules/sms-campaigns/migrations/0001_initial.sql"` passed | Pass |

### Phase 53 StackSuite Support Inbox module

- **Status:** complete.
- Goal: port the HelpGrid widget/conversation workflow without colliding with active `support-ticket` and `knowledge-base-rag` edits.
- Added `modules/support-inbox` for project-scoped widget settings, quick actions, conversations, messages, channel connection metadata, and agent takeover state.
- Kept ticket escalation and grounded answers out of this module; those remain integration boundaries for `support-ticket` and `knowledge-base-rag`.
- Stored channel provider credentials as secret refs (`accessTokenRef`, `webhookVerifyTokenRef`), not raw tokens.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Support Inbox build | TypeScript typecheck passes | `pnpm --filter @microservices-sh/support-inbox build` passed | Pass |
| Support Inbox tests | Widget, conversation, takeover, and channel workflows pass | `pnpm --filter @microservices-sh/support-inbox test` passed, 3/3 | Pass |
| Support Inbox spec | Module contract check passes | `pnpm --filter @microservices-sh/support-inbox check:spec` passed | Pass |
| D1 migration | Module migration loads in SQLite | `sqlite3 :memory: ".read modules/support-inbox/migrations/0001_initial.sql"` passed | Pass |
| JSON docs | OpenAPI and JSON schema stubs parse | Node JSON parse check passed | Pass |

### Phase 54 StackSuite Membership Credits module

- **Status:** complete.
- Goal: port the booking-system membership tier and customer credit ledger domain into a reusable module.
- Added `modules/membership-credits` for membership tiers, active customer memberships, credit balances, credit ledger transactions, and membership history.
- Stored all monetary amounts as integer cents instead of the donor app's floating-point `real` amounts.
- Added idempotent reference handling for booking credit applications/refunds, plus overdraft prevention.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Membership Credits build | TypeScript typecheck passes | `pnpm --filter @microservices-sh/membership-credits build` passed | Pass |
| Membership Credits tests | Tier, membership, credit, idempotency, and expiry flows pass | `pnpm --filter @microservices-sh/membership-credits test` passed, 3/3 | Pass |
| Membership Credits spec | Module contract check passes | `pnpm --filter @microservices-sh/membership-credits check:spec` passed | Pass |
| D1 migration | Module migration loads in SQLite | `sqlite3 :memory: ".read modules/membership-credits/migrations/0001_initial.sql"` passed | Pass |
| JSON docs | OpenAPI and JSON schema stubs parse | Node JSON parse check passed | Pass |

### Phase 55 StackSuite Estimate Quote module

- **Status:** complete.
- Goal: port accounting-system estimate/quote lifecycle into a reusable module without touching the concurrently dirty `invoice` module.
- Added `modules/estimate-quote` for quote numbering, draft line-item edits, integer-cents totals, send/view/accept/decline/expire/void lifecycle transitions, and invoice conversion metadata.
- Kept invoice creation outside the module: conversion records a caller-supplied invoice id and returns an invoice draft payload for an invoice module or route adapter to persist.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Estimate Quote build | TypeScript typecheck passes | `pnpm --filter @microservices-sh/estimate-quote build` passed | Pass |
| Estimate Quote tests | Totals, lifecycle, conversion, expiry, and stats pass | `pnpm --filter @microservices-sh/estimate-quote test` passed, 3/3 | Pass |
| Estimate Quote spec | Module contract check passes | `pnpm --filter @microservices-sh/estimate-quote check:spec` passed | Pass |
| D1 migration | Module migration loads in SQLite | `sqlite3 :memory: ".read modules/estimate-quote/migrations/0001_initial.sql"` passed | Pass |
| JSON docs | OpenAPI and JSON schema stubs parse | Node JSON parse check passed | Pass |

### Phase 56 StackSuite Recurring Documents module

- **Status:** complete.
- Goal: port accounting-system recurring invoice and recurring bill workflows into a reusable module without writing into the dirty `invoice` module or AP route code.
- Added `modules/recurring-documents` for recurring invoice/bill templates, line-item totals in integer cents, next-run tracking, max occurrences, end dates, pause/resume/cancel lifecycle, and due-cycle generation.
- Generation returns draft invoice/bill payloads and updates recurrence tracking; final persistence, sending, approval, posting, and voiding remain integration boundaries.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Recurring Documents build | TypeScript typecheck passes | `pnpm --filter @microservices-sh/recurring-documents build` passed | Pass |
| Recurring Documents tests | Template totals, generation, completion, pause, and resume pass | `pnpm --filter @microservices-sh/recurring-documents test` passed, 3/3 | Pass |
| Recurring Documents spec | Module contract check passes | `pnpm --filter @microservices-sh/recurring-documents check:spec` passed | Pass |
| D1 migration | Module migration loads in SQLite | `sqlite3 :memory: ".read modules/recurring-documents/migrations/0001_initial.sql"` passed | Pass |
| JSON docs | OpenAPI and JSON schema stubs parse | Node JSON parse check passed | Pass |

### Phase 57 StackSuite Storage Entitlements module

- **Status:** complete.
- Goal: port DashDrive storage quota, package purchase, expiring share link, and download-count behavior into a reusable module without changing `file-media`.
- Added `modules/storage-entitlements` for owner-scoped storage accounts, quota/usage accounting, storage packages, idempotent purchase completion by external session id, expiring share links, revocation, and download counts.
- Kept byte upload, R2 signing, and object deletion outside the module; those remain `file-media` or app-adapter responsibilities.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Storage Entitlements build | TypeScript typecheck passes | `pnpm --filter @microservices-sh/storage-entitlements build` passed | Pass |
| Storage Entitlements tests | Quota, purchase, and share-link flows pass | `pnpm --filter @microservices-sh/storage-entitlements test` passed, 3/3 | Pass |
| Storage Entitlements spec | Module contract check passes | `pnpm --filter @microservices-sh/storage-entitlements check:spec` passed | Pass |
| D1 migration | Module migration loads in SQLite | `sqlite3 :memory: ".read modules/storage-entitlements/migrations/0001_initial.sql"` passed | Pass |
| JSON docs | OpenAPI and JSON schema stubs parse | Node JSON parse check passed | Pass |

### Phase 58 StackSuite HR People Ops module

- **Status:** complete.
- Goal: port HR System employee, department, position, leave, and attendance workflows into a reusable module.
- Added `modules/hr-people-ops` for employee profiles, departments, positions, leave types, leave balances, leave request lifecycle, and attendance records.
- Stored leave balances as integer hundredths of a day instead of the donor app's floating-point day totals.
- Kept payroll, benefits, local tax rules, auth/session tables, and complex scheduling outside the module boundary.

| Check | Expectation | Result | Status |
|---|---|---|---|
| HR People Ops build | TypeScript typecheck passes | `pnpm --filter @microservices-sh/hr-people-ops build` passed | Pass |
| HR People Ops tests | Employee, leave, and attendance flows pass | `pnpm --filter @microservices-sh/hr-people-ops test` passed, 3/3 | Pass |
| HR People Ops spec | Module contract check passes | `pnpm --filter @microservices-sh/hr-people-ops check:spec` passed | Pass |
| D1 migration | Module migration loads in SQLite | `sqlite3 :memory: ".read modules/hr-people-ops/migrations/0001_initial.sql"` passed | Pass |
| JSON docs | OpenAPI and JSON schema stubs parse | Node JSON parse check passed | Pass |

### Phase 59 StackSuite URL Shortener module

- **Status:** complete.
- Goal: port the URL Shortener app's durable short-link and click-analytics workflow into a reusable utility module.
- Added `modules/url-shortener` for tenant-scoped link creation, URL validation, custom aliases, expiry, deactivation, redirect resolution, click recording, stats, and recent-link reporting.
- Kept KV redirect caching outside the module; app route adapters can cache resolved links while D1 remains the source of truth.

| Check | Expectation | Result | Status |
|---|---|---|---|
| URL Shortener build | TypeScript typecheck passes | `pnpm --filter @microservices-sh/url-shortener build` passed | Pass |
| URL Shortener tests | Alias, expiry, redirect, analytics, and deactivation flows pass | `pnpm --filter @microservices-sh/url-shortener test` passed, 3/3 | Pass |
| URL Shortener spec | Module contract check passes | `pnpm --filter @microservices-sh/url-shortener check:spec` passed | Pass |
| D1 migration | Module migration loads in SQLite | `sqlite3 :memory: ".read modules/url-shortener/migrations/0001_initial.sql"` passed | Pass |
| JSON docs | OpenAPI and JSON schema stubs parse | Node JSON parse check passed | Pass |

### Phase 60 StackSuite HTML Renderer module

- **Status:** complete.
- Goal: port the HTML Renderer app's slug/TTL/mockup storage workflow into a reusable utility module.
- Added `modules/html-renderer` for HTML render document creation, slug validation, TTL expiry, asset metadata validation, resolve, soft delete, and listing.
- Kept public route auth, KV/R2 object storage, and large binary asset upload outside the module boundary.
- Confirmed QR Generator is browser-only in the donor app, so it should stay a reference UI/free-tool candidate unless a template needs durable QR asset records.

| Check | Expectation | Result | Status |
|---|---|---|---|
| HTML Renderer build | TypeScript typecheck passes | `pnpm --filter @microservices-sh/html-renderer build` passed | Pass |
| HTML Renderer tests | Slug, TTL, asset, expiry, resolve, and delete flows pass | `pnpm --filter @microservices-sh/html-renderer test` passed, 3/3 | Pass |
| HTML Renderer spec | Module contract check passes | `pnpm --filter @microservices-sh/html-renderer check:spec` passed | Pass |
| D1 migration | Module migration loads in SQLite | `sqlite3 :memory: ".read modules/html-renderer/migrations/0001_initial.sql"` passed | Pass |
| JSON docs | OpenAPI and JSON schema stubs parse | Node JSON parse check passed | Pass |

### Phase 61 StackSuite Content CMS module

- **Status:** complete.
- Goal: port the CMS app's reusable content model into a headless module without cloning its admin app, auth, billing, setup, AI designer, or public renderer.
- Added `modules/content-cms` for content types, field definitions, versioned entries, publish/archive lifecycle, entry snapshots, localizations, locale settings, and media metadata.
- Added memory and D1 stores plus migration tables for content definitions, entries, versions, localization records, locales, media assets, and domain events.
- Kept R2 uploads, CDN/public URL policy, route rendering, API-key auth, tenant quota, and AI page generation as app-adapter or companion-module responsibilities.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Content CMS build | TypeScript typecheck passes | `pnpm --filter @microservices-sh/content-cms build` passed | Pass |
| Content CMS tests | Content model, versioning, publishing, localization, locale, and media flows pass | `pnpm --filter @microservices-sh/content-cms test` passed, 3/3 | Pass |
| Content CMS spec | Module contract check passes | `pnpm --filter @microservices-sh/content-cms check:spec` passed | Pass |
| D1 migration | Module migration loads in SQLite | `sqlite3 :memory: ".read modules/content-cms/migrations/0001_initial.sql"` passed | Pass |
| JSON docs | OpenAPI, manifest, and JSON schemas parse | Node JSON parse check passed | Pass |

### Phase 62 StackSuite Video Generation module

- **Status:** complete.
- Goal: port reusable async video-generation state from StackSuite video donors without copying their full product UI, auth, Stripe credits, provider-specific routes, or browser media tooling.
- Added `modules/video-generation` for provider-neutral video jobs, provider task ids, reference asset metadata, normalized status reconciliation, idempotent provider URL output records, app-owned output attachment, cancellation, listing, and snapshots.
- Added memory and D1 stores plus migration tables for generation jobs, outputs, and domain events.
- Confirmed `markdown-to-pdf` is browser/localStorage/html2pdf.js free-tool material; a future `document-renderer` should wait until multiple invoice/quote/content routes need shared server-side PDF jobs.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Video Generation build | TypeScript typecheck passes | `pnpm --filter @microservices-sh/video-generation build` passed | Pass |
| Video Generation tests | Job create, submit, completion, idempotent outputs, output attachment, cancel, and list flows pass | `pnpm --filter @microservices-sh/video-generation test` passed, 3/3 | Pass |
| Video Generation spec | Module contract check passes | `pnpm --filter @microservices-sh/video-generation check:spec` passed | Pass |
| D1 migration | Module migration loads in SQLite | `sqlite3 :memory: ".read modules/video-generation/migrations/0001_initial.sql"` passed | Pass |
| JSON docs | OpenAPI, manifest, and JSON schemas parse | Node JSON parse check passed | Pass |

### Phase 63 StackSuite Project Progress module

- **Status:** complete.
- Goal: port EPMIS customer-facing project progress tracking without copying its full auth, customer, QR, R2, email, or Svelte UI implementation.
- Added `modules/project-progress` for project records, worker access grants, progress logs, media metadata, comments, public access-token snapshots, listing, and tenant-scoped memory/D1 persistence.
- Added migration tables for projects, access grants, logs, media files, comments, and domain events.
- Kept auth/users/customers, QR image generation, byte uploads, R2 signing, email logs, and UI as route-adapter or companion-module responsibilities.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Project Progress build | TypeScript typecheck passes | `pnpm --filter @microservices-sh/project-progress build` passed | Pass |
| Project Progress tests | Project, access, timeline, media, comment, tenant isolation, status, and revoke flows pass | `pnpm --filter @microservices-sh/project-progress test` passed, 4/4 | Pass |
| Project Progress spec | Module contract check passes | `pnpm --filter @microservices-sh/project-progress check:spec` passed | Pass |
| D1 migration | Module migration loads in SQLite | `sqlite3 :memory: ".read modules/project-progress/migrations/0001_initial.sql"` passed | Pass |
| JSON docs | OpenAPI, manifest, and JSON schemas parse | Node JSON parse check passed | Pass |

### Phase 64 HelpGrid support-ticket hardening

- **Status:** complete.
- Goal: finish the HelpGrid ticket follow-up gap without merging support inbox/widget behavior back into `support-ticket`.
- Added per-tenant ticket sequence numbers to core tickets.
- Added durable ticket comments, internal-note filtering, attachment metadata, public follow-up share tokens, public token snapshots, and scoped wrappers for tenant-sensitive admin actions.
- Added memory and D1 store support plus migration tables for sequences, comments, attachments, and share tokens.
- Kept pending upload sessions, raw R2 uploads, signed URLs, AI analyses/follow-up questions, billing tokens, WhatsApp, and UI outside the module boundary.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Support Ticket build | TypeScript typecheck passes | `pnpm --filter @microservices-sh/support-ticket build` passed | Pass |
| Support Ticket tests | Ticket CRUD, tenant scoping, sequences, comments, attachments, share tokens, expiry, and public snapshots pass | `pnpm --filter @microservices-sh/support-ticket test` passed, 18/18 | Pass |
| Support Ticket spec | Module contract check passes | `pnpm --filter @microservices-sh/support-ticket check:spec` passed | Pass |
| D1 migration | Module migrations load in SQLite | `sqlite3 :memory: ".read modules/support-ticket/migrations/0001_support_ticket.sql" ".read modules/support-ticket/migrations/0002_ticket_thread_share_tokens.sql"` passed | Pass |
| JSON docs | OpenAPI, manifest, and JSON schemas parse | Node JSON parse check passed | Pass |

### Phase 65 StackSuite accounting and commerce parity hardening

- **Status:** complete.
- Goal: close the highest-value parity gaps found after the initial StackSuite accounting/commerce module and template split.
- Added commerce document export helpers, invoice-send/payment-link workflow, Stripe settlement webhook handling, scheduled runtime glue, and WooCommerce signed webhook/order import lifecycle routing.
- Hardened commerce inventory lifecycle side effects: confirmed sales orders reserve stock, terminal sales-order transitions release reservations, combo products reserve component stock, MCP tools run the same side effects as routes, invoice handoff releases order reservations, and shipment completion deducts on-hand stock for invoice-originated orders.
- Added accounting scheduled runtime glue, AR/AP aging and customer statement reports, invoice collection/payment-link/email workflow, signed Stripe settlement handling, and ledger posting for manually issued invoices plus applied customer payments.
- Kept donor behavior adapted through module ports and template-side adapters instead of copying donor app routes or floating-point money persistence.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Commerce lifecycle integration tests | WooCommerce import, MCP lifecycle, sales-order inventory, document export, and invoice-payment workflows pass | Targeted `pnpm vitest run ...commerce...` suites passed across the committed slices | Pass |
| Accounting AR settlement tests | Accounts Receivable posting and settlement behavior passes | `pnpm --filter @microservices-sh/accounts-receivable test` passed, 4/4 | Pass |
| Accounting module builds | AR and accounting-core build/typecheck pass | `pnpm --filter @microservices-sh/accounts-receivable build` and `pnpm --filter @microservices-sh/accounting-core build` passed | Pass |
| Focused template checks | Accounting and commerce template contract checks pass | Focused template checks passed across the committed slices | Pass |
| Focused template builds | SvelteKit/Cloudflare builds complete with scheduled-handler injection | Focused template builds passed across the committed slices | Pass |
| Workspace specs | All module/template specs remain green | `pnpm spec:check:all` passed after each committed slice | Pass |
| Create package | Bundled template closure and generated-app smoke still pass | `pnpm --filter create-microservices-app build` and `smoke:built` passed | Pass |
| Whitespace | No trailing whitespace/conflict markers | `git diff --check` passed | Pass |

### Phase 66 recurring invoice accounting job parity

- **Status:** complete.
- Goal: close the remaining accounting gap where recurring invoice jobs could auto-issue invoices without the manual invoice issue path's GL posting and AR snapshot sync.
- Updated the recurring invoice job handler to post every generated non-draft invoice through `postIssuedInvoiceToAccounting` and sync it through `syncInvoiceToReceivables`.
- Passed accounting and receivables stores into the handler from both Cloudflare scheduled runtime and the operator-run due jobs route.
- Added a regression test that seeds chart of accounts/fiscal periods, creates an auto-issue recurring invoice template, runs the registered job handler, and asserts a posted AR invoice journal plus open receivable snapshot.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Scheduled runtime regression | Auto-issued recurring invoices post to GL and sync to AR | `pnpm vitest run tests/integration/accounting-scheduled-runtime.test.ts` passed, 2/2 | Pass |
| Accounting template spec | Template assertions include accounting-aware recurring job handlers | `node packages/workspace-tools/src/index.js check template --path templates/accounting-erp-sveltekit` passed | Pass |
| Accounting template build | SvelteKit/Cloudflare build compiles the updated scheduled runtime | `pnpm --dir templates/accounting-erp-sveltekit build` passed | Pass |
| Workspace specs | All module/template specs remain green | `pnpm spec:check:all` passed, 64 targets | Pass |
| Create package build | Bundled create-app artifact builds after template runtime changes | `pnpm --filter create-microservices-app build` passed | Pass |
| Create package smoke | Built create package can generate/check a project | `pnpm --filter create-microservices-app smoke:built` passed | Pass |
| Whitespace | No trailing whitespace/conflict markers | `git diff --check` passed | Pass |

### Phase 67 accounting ledger tenant scoping fix

- **Status:** complete.
- Goal: fix the route bug found during the accounting parity audit where `/app/ledger` account creation referenced an out-of-scope `org` variable instead of the resolved company context.
- Changed account creation to use `ctx.org.id`, matching the rest of the ledger actions.
- Extended accounting template assertions to require account creation and active-org tenant scoping in the ledger route.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Accounting template spec | Ledger route assertion covers account creation and `tenantId: ctx.org.id` | `node packages/workspace-tools/src/index.js check template --path templates/accounting-erp-sveltekit` passed | Pass |
| Accounting template build | SvelteKit/Cloudflare build compiles the ledger route | `pnpm --dir templates/accounting-erp-sveltekit build` passed | Pass |
| Whitespace | No trailing whitespace/conflict markers | `git diff --check` passed | Pass |

### Phase 68 commerce stale billing hook cleanup

- **Status:** complete.
- Goal: finish the commerce audit cleanup by removing obsolete request-hook wiring for a billing store surface that no longer exists in the commerce template stores or locals contract.
- Removed `event.locals.billingStore = stores.billingStore` from the commerce request hook.
- Added a commerce template policy assertion so `src/hooks.server.ts` stays free of stale `billingStore` wiring.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Commerce template spec | Template policy rejects stale billing-store hook wiring | `node packages/workspace-tools/src/index.js check template --path templates/commerce-ops-sveltekit` passed | Pass |
| Commerce template build | SvelteKit/Cloudflare build compiles the updated hook | `pnpm --dir templates/commerce-ops-sveltekit build` passed | Pass |
| Workspace specs | All module/template specs remain green after the commerce policy update | `pnpm spec:check:all` passed, 64 targets | Pass |
| Whitespace | No trailing whitespace/conflict markers | `git diff --check` passed | Pass |

### Phase 69 StackSuite public plan refresh

- **Status:** complete.
- Goal: keep the public StackSuite porting plan aligned with the committed accounting/commerce module and focused-template baseline.
- Updated the document status, implementation baseline, explorer-finding status, phased execution status, and remaining backlog.
- Added explicit Code Memory donor-scan guidance for `accounting-system` and `invoice-system-bao` local sources.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Documentation diff | Plan reflects completed parity and remaining backlog without changing code behavior | Reviewed `git diff -- docs/templates/stacksuite-porting-plan.md` | Pass |
| Stale wording scan | Public plan no longer claims completed parity work is still absent | `rg -n "still thin|not yet represented|Both explorers flagged|Done or in progress|Add missing module API surface" docs/templates/stacksuite-porting-plan.md` returned no matches | Pass |
| Whitespace | No trailing whitespace/conflict markers | `git diff --check` passed | Pass |

### Phase 70 commerce generated-app packaging fix

- **Status:** complete.
- Goal: close the P0 CLI/template packaging failures found by the StackSuite packaging audit.
- Bundled `@microservices-sh/sdk-internal` and `@microservices-sh/module-contract` as generated-app support packages for templates that depend on SDK/MCP helpers.
- Rewrote copied support-package package.json dependencies, so `sdk-internal` points at `file:../module-contract` instead of retaining `workspace:*`.
- Added `readText` to the generated SvelteKit contract-check runner and synced all SvelteKit project shims.
- Added create-app built-smoke coverage to reject runtime `workspace:*` dependencies in generated root, module, and support-package manifests.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Create app build | Bundled templates materialize support packages and dist compiles | `pnpm --filter create-microservices-app build` passed | Pass |
| Bundle closure | Template dependency closure remains complete | `pnpm exec vitest run packages/create-microservices-app/tests/template-bundle-closure.test.js` passed, 33/33 | Pass |
| Built smoke | Generated app smoke rejects runtime workspace deps and still scaffolds templates | `pnpm --filter create-microservices-app smoke:built` passed | Pass |
| Create app tests | Node test suite remains green | `pnpm --filter create-microservices-app test` passed, 19/19 | Pass |
| Shim sync | Generated project shims include `readText` and stay in sync | `pnpm check:shims` passed, 13 targets | Pass |
| Workspace specs | All module/template specs remain green | `pnpm spec:check:all` passed, 64 targets | Pass |
| Generated install | Fresh commerce generated app installs without root/support-package `workspace:*` runtime deps | `pnpm --dir /tmp/stackstatus-p0-commerce-fix install --lockfile-only --ignore-scripts` passed | Pass |
| Generated check | Fresh commerce generated app contract check passes with `readText` policy | `node scripts/microservices.js check --json` passed in `/tmp/stackstatus-p0-commerce-fix` | Pass |
| Whitespace | No trailing whitespace/conflict markers | `git diff --check` passed | Pass |

### Phase 71 focused template email lock alignment

- **Status:** complete.
- Goal: reconcile the focused template manifests/packages with their lockfiles for the `email` module used by login and invoice-send workflows.
- Added the canonical `email` module lock entry to both `commerce-ops-sveltekit` and `accounting-erp-sveltekit`.
- Added template policy assertions requiring `email.write` and `beforeEmailSend` to stay represented in both lockfiles.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Lock JSON | Both focused locks include `email.write` in the email contract | `jq -e '.modules[] | select(.id=="email") | .contract.permissions | index("email.write")' ...` passed for both templates | Pass |
| Focused template specs | Email lock assertions pass | `node packages/workspace-tools/src/index.js check template --path templates/commerce-ops-sveltekit` and accounting equivalent passed | Pass |
| Create app build | Bundled focused templates include updated locks | `pnpm --filter create-microservices-app build` passed | Pass |
| Workspace specs | All module/template specs remain green | `pnpm spec:check:all` passed, 64 targets | Pass |
| Built smoke | Generated app smoke remains green with updated focused locks | `pnpm --filter create-microservices-app smoke:built` passed | Pass |
| Whitespace | No trailing whitespace/conflict markers | `git diff --check` passed | Pass |

### Phase 72 commerce sync migration ownership cleanup

- **Status:** complete.
- Goal: remove a misleading inherited commerce-sync migration table declaration now that `0001_core.sql` owns the shared `domain_events` schema.
- Removed `CREATE TABLE IF NOT EXISTS domain_events` from `templates/commerce-ops-sveltekit/migrations/0027_commerce_sync.sql`.
- Added a commerce template policy assertion that reads the migration and rejects future `domain_events` redeclarations.
- Kept broader ERP/accounting duplicate migration declarations out of this slice because those templates still carry inherited module histories and need a separate migration-ownership review.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Focused template spec | Commerce policy rejects commerce-sync `domain_events` redeclaration | `node packages/workspace-tools/src/index.js check template --path templates/commerce-ops-sveltekit` passed | Pass |
| Migration smoke | Core plus commerce-sync migrations load in SQLite after removing the duplicate block | `sqlite3 :memory: ".read templates/commerce-ops-sveltekit/migrations/0001_core.sql" ".read templates/commerce-ops-sveltekit/migrations/0027_commerce_sync.sql"` passed | Pass |
| Duplicate scan | Commerce sync migration no longer declares `domain_events` | `rg -n "CREATE TABLE IF NOT EXISTS domain_events" templates/commerce-ops-sveltekit/migrations/0027_commerce_sync.sql` returned no matches | Pass |
| Workspace specs | All module/template specs remain green | `pnpm spec:check:all` passed, 64 targets | Pass |
| Commerce template build | SvelteKit/Cloudflare build compiles after the migration cleanup | `pnpm --dir templates/commerce-ops-sveltekit build` passed | Pass |
| Whitespace | No trailing whitespace/conflict markers | `git diff --check` passed | Pass |

### Phase 73 commerce MCP lock-authoritative catalog

- **Status:** complete.
- Goal: align the commerce template's generated MCP server, hand-authored wiring, and visible Agent Center catalog with the template lockfile RPC snapshot.
- Changed `scripts/generate-mcp.mjs` to generate from `microservices.lock.json` `contract.rpc` entries only, instead of merging module `connections` from workspace or vendored package layouts.
- Removed MCP handlers for `payment_createPaymentIntent` and `org-team-rbac_authorize` because those methods are not declared in the commerce template lock.
- Changed Agent Center to compute visible `module_method` tool names from the lock snapshot, so UI routes without declared RPC tools no longer inflate the callable-agent surface.
- Added template and integration-test guards for lock-authoritative generation, 50 commerce MCP tools, and absence of unlocked handlers.
- Rebuilt the create package so the packaged commerce template copy reflects the root commerce template changes, including the earlier commerce-sync migration guard.

| Check | Expectation | Result | Status |
|---|---|---|---|
| MCP generation | Commerce generated MCP artifacts are lock-authoritative and report 50 tools | `pnpm --dir templates/commerce-ops-sveltekit generate:mcp` passed and reported 50 tools | Pass |
| Commerce MCP wiring test | Generated manifest names and hand-authored handlers match exactly; unlocked payment/RBAC handlers are absent | `pnpm exec vitest run tests/integration/commerce-ops-mcp-wiring.test.ts` passed, 5/5 | Pass |
| Focused template spec | Template policies enforce lock-derived MCP generation, wiring, and Agent Center catalog | `node packages/workspace-tools/src/index.js check template --path templates/commerce-ops-sveltekit` passed | Pass |
| Commerce template build | SvelteKit/Cloudflare build compiles the lock-derived Agent Center route | `pnpm --dir templates/commerce-ops-sveltekit build` passed | Pass |
| Workspace specs | All module/template specs remain green | `pnpm spec:check:all` passed, 64 targets | Pass |
| Create app build | Packaged commerce template copy is rebuilt from root template sources | `pnpm --filter create-microservices-app build` passed | Pass |
| Packaged template spec | Packaged commerce template has the same guards as the root template | `node packages/workspace-tools/src/index.js check template --path packages/create-microservices-app/templates/commerce-ops-sveltekit` passed | Pass |
| Built smoke | Generated app smoke remains green after commerce template packaging sync | `pnpm --filter create-microservices-app smoke:built` passed | Pass |
| Drift scan | Packaged commerce copy has no stale commerce-sync table/generator/handler matches beyond negative assertions | `rg -n "CREATE TABLE IF NOT EXISTS domain_events|loadConnections|payment_createPaymentIntent|org-team-rbac_authorize" packages/create-microservices-app/templates/commerce-ops-sveltekit/...` returned only negative guard assertions | Pass |
| Whitespace | No trailing whitespace/conflict markers | `git diff --check` passed | Pass |

### Phase 74 accounting domain event schema alignment

- **Status:** complete.
- Goal: fix the focused accounting template runtime mismatch where `0001_core.sql` created `domain_events(event_name, entity_type, entity_id)` but accounting D1 writers and later accounting migrations still expected `event_type` and `aggregate_id`.
- Updated `accounting-core` and `accounts-payable` D1 event writers to insert `event_name`, `entity_type`, and `entity_id`.
- Standardized the standalone accounting-core, accounts-payable, accounts-receivable, and bank-reconciliation migrations on the shared `domain_events` schema.
- Removed duplicate `domain_events` declarations from the focused accounting AP, AR, and bank migrations so `0001_core.sql` remains the sole owner.
- Added accounting template policy assertions for core ownership and no later AP/AR/bank redeclarations.
- Rebuilt the create package so packaged accounting generated apps carry the fixed migrations and module sources.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Focused accounting spec | Template asserts core-owned `domain_events` and no AP/AR/bank redeclarations | `node packages/workspace-tools/src/index.js check template --path templates/accounting-erp-sveltekit` passed | Pass |
| Accounting-core build/test | D1 writer SQL typechecks and existing accounting behavior stays green | `pnpm --filter @microservices-sh/accounting-core build` and `test` passed, 9/9 | Pass |
| Accounts-payable build/test | D1 writer SQL typechecks and AP workflows stay green | `pnpm --filter @microservices-sh/accounts-payable build` and `test` passed, 11/11 | Pass |
| AR/bank builds | Standalone migration changes do not break packages | `pnpm --filter @microservices-sh/accounts-receivable build` and `pnpm --filter @microservices-sh/bank-reconciliation build` passed | Pass |
| Template migration smoke | Focused accounting migration order accepts standard event inserts | SQLite read of `0001_core.sql`, `0023`, `0024`, `0025`, `0026` plus standard insert passed | Pass |
| Standalone module migration smoke | Accounting-core and AP standalone migrations accept standard event inserts | SQLite reads plus standard inserts passed for both modules | Pass |
| Workspace specs | All module/template specs remain green | `pnpm spec:check:all` passed, 64 targets | Pass |
| Accounting template build | SvelteKit/Cloudflare build compiles after migration policy update | `pnpm --dir templates/accounting-erp-sveltekit build` passed | Pass |
| Create app build | Packaged accounting template copy is rebuilt from root template/module sources | `pnpm --filter create-microservices-app build` passed | Pass |
| Packaged template spec | Packaged accounting template has the same domain-event guards as root | `node packages/workspace-tools/src/index.js check template --path packages/create-microservices-app/templates/accounting-erp-sveltekit` passed | Pass |
| Built smoke | Generated app smoke remains green after accounting template packaging sync | `pnpm --filter create-microservices-app smoke:built` passed | Pass |
| Drift scan | Packaged accounting copy has no stale AP/AR/bank table or event-type writer matches beyond negative assertions | `rg -n "CREATE TABLE IF NOT EXISTS domain_events|event_type TEXT NOT NULL|aggregate_id|INSERT INTO domain_events \\(id, event_type" packages/create-microservices-app/templates/accounting-erp-sveltekit/...` returned only negative guard assertions | Pass |
| Whitespace | No trailing whitespace/conflict markers | `git diff --check` passed | Pass |

### Phase 75 StackSuite docs catalog metadata sync

- **Status:** complete.
- Goal: remove docs/catalog drift for the StackSuite commerce and accounting modules while preserving their current promotion state.
- Synced the simplified docs module catalog rows for product catalog, inventory, sales order, shipment, commerce sync, accounting core, accounts payable, accounts receivable, bank reconciliation, and email from the generated registry metadata.
- Kept StackSuite modules `draft` until generated-project smoke and promotion criteria are intentionally completed.
- Marked `email` `available` in the docs catalog to match the module manifest and focused-template lock usage.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Catalog JSON | Docs module catalog remains valid JSON | `jq -e '.modules | length' docs/modules/catalog.json` returned 21 | Pass |
| Registry drift | Selected docs rows match `.generated/registry/catalog.json` for status, class, summary, requires, RPC, permissions, hooks, and events | Node comparison script passed | Pass |
| Promotion state | StackSuite modules stay draft and email is available | `jq -r ... docs/modules/catalog.json` showed StackSuite rows as `draft` and `email` as `available` | Pass |
| Workspace specs | All module/template specs remain green after docs catalog sync | `pnpm spec:check:all` passed, 64 targets | Pass |
| Whitespace | No trailing whitespace/conflict markers | `git diff --check` passed | Pass |

### Phase 76 commerce domain event schema alignment

- **Status:** complete.
- Goal: fix the focused commerce template runtime mismatch where `0001_core.sql` owns `domain_events(event_name, entity_type, entity_id)` but product-catalog, sales-order, and shipment D1 writers still inserted legacy `event_type` and `aggregate_id` columns.
- Updated product-catalog, sales-order, and shipment D1 event writers to insert `event_name`, `entity_type`, and `entity_id`.
- Standardized product-catalog, sales-order, shipment, and commerce-sync standalone migrations on the shared `domain_events` schema.
- Added commerce template assertions that focused commerce migrations do not redeclare the core-owned table and that packaged module migrations use the shared schema.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Module checks | Product catalog, sales order, shipment, and commerce-sync manifests/specs remain valid | `node packages/workspace-tools/src/index.js check module --path ...` passed for all four modules | Pass |
| Module builds/tests | Updated D1 writer SQL typechecks and existing commerce behavior stays green | Product catalog, sales order, shipment, and commerce-sync builds passed; product catalog, sales order, and shipment tests passed | Pass |
| Standalone migration smokes | Module migrations accept standard `domain_events` inserts | SQLite reads plus standard event inserts passed for product catalog, sales order, shipment, and commerce-sync | Pass |
| Focused template migration smoke | Commerce migration order accepts a standard domain-event insert with explicit `created_at` | SQLite read of `0001_core`, product, inventory, sales-order, shipment, and commerce-sync migrations plus standard insert passed | Pass |
| Commerce template checks | Root and packaged commerce template policies enforce core-owned event schema | `node packages/workspace-tools/src/index.js check template --path templates/commerce-ops-sveltekit` and packaged equivalent passed | Pass |
| Commerce template build | SvelteKit/Cloudflare build compiles after writer and policy updates | `pnpm --dir templates/commerce-ops-sveltekit build` passed | Pass |
| Create app build/smoke | Generated app package rebuild and smoke remain green after module copy refresh | `pnpm --filter create-microservices-app build` and `smoke:built` passed | Pass |
| Workspace specs | All module/template specs remain green | `pnpm spec:check:all` passed, 64 targets | Pass |
| Drift scan | Targeted modules and packaged copies have no legacy event-column writer or migration matches | `rg -n "INSERT INTO domain_events \\(id, event_type|event_type TEXT NOT NULL|aggregate_id TEXT" ...` returned no matches | Pass |
| Whitespace | No trailing whitespace/conflict markers | `git diff --check` passed | Pass |

### Phase 77 generated StackSuite install/build smoke

- **Status:** complete.
- Goal: add a generated-app gate that catches dependency-resolution and parser/toolchain differences between the source templates and freshly scaffolded StackSuite apps.
- Added `smoke:stacksuite` to `create-microservices-app`; the deep path scaffolds accounting and commerce repo templates, installs dependencies, runs `pnpm build`, and runs generated `scripts/microservices.js check --json`.
- Added generated-root dependency linking for copied support packages such as `@microservices-sh/connection-contract`, so linked copied modules resolve local support packages from generated apps.
- Added scaffold assertions that every copied support package is represented as a root `link:./packages/...` dependency.
- Enabled Svelte preprocessing across SvelteKit templates and converted focused accounting/commerce route scripts to plain JavaScript so generated apps build under fresh installs where route-level TypeScript annotations are not stripped.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Focused template builds | Root accounting and commerce templates compile after route script conversion | `pnpm --dir templates/accounting-erp-sveltekit build` and `pnpm --dir templates/commerce-ops-sveltekit build` passed | Pass |
| Create package build | Packaged repo templates include smoke harness and dependency linking changes | `pnpm --filter create-microservices-app build` passed | Pass |
| Create package tests | Unit tests and shim drift test remain green | `pnpm --filter create-microservices-app test` passed, 19/19 | Pass |
| Deep generated smoke | Fresh accounting and commerce generated apps install, build, and pass generated checks | `pnpm --filter create-microservices-app smoke:stacksuite` passed | Pass |
| Workspace specs | All module/template specs remain green | `pnpm spec:check:all` passed, 64 targets | Pass |
| Shim sync | Canonical and packaged microservices shims remain in sync | `pnpm check:shims` passed, 13 targets | Pass |
| Whitespace | No trailing whitespace/conflict markers | `git diff --check` passed | Pass |

### Phase 78 StackSuite public docs catalog closure

- **Status:** complete.
- Goal: close the public docs/catalog gaps left after quote and recurring document modules became part of the focused accounting template route proof.
- Added `estimate-quote` and `recurring-documents` rows to `docs/modules/catalog.json`.
- Added public module reference pages for `estimate-quote` and `recurring-documents`.
- Refreshed `docs/modules/README.md` and `docs/llms.txt` so StackSuite commerce/accounting module docs are discoverable.
- Corrected stale `commerce-sync` secret wording and `email` status/provider-secret wording.
- Updated StackSuite planning docs so quote/recurring route proof is no longer listed as pending.

| Check | Expectation | Result | Status |
|---|---|---|---|
| Catalog JSON | Docs module catalog includes quote and recurring modules and remains valid JSON | `jq -e '.modules | length' docs/modules/catalog.json` returned 23 | Pass |
| Catalog spot check | Commerce sync has no module-owned secret; email is available with current provider secrets | `jq -r ... docs/modules/catalog.json` showed expected rows | Pass |
| Docs presence | Public module docs exist and are linked from the index and LLM guide | `rg` checks passed for new docs/index references | Pass |
| Workspace specs | All module/template specs remain green after docs updates | `pnpm spec:check:all` passed, 64 targets | Pass |
| Whitespace | No trailing whitespace/conflict markers | `git diff --check` passed | Pass |

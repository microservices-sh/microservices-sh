# Product Roadmap Status Audit

Generated: 2026-06-20

## Verdict
The product is no longer at the earliest planning stage. A lot of Phase 1/2 developer proof work is real: the create package builds, bundles 7 templates, smoke tests pass, key templates pass spec checks, module registry generation sees 28 modules, MCP distribution is live/underway, and the booking module test suite is green.

The biggest gap is not raw feature count. The gap is launch coherence:

- public/runtime surfaces do not all tell the same truth yet
- public launch docs now use System Harness positioning; older planning docs still mention boilerplates as comparison context
- root CLI catalog is behind the create-package/template registry, so public docs now make the generated project CLI canonical
- full spec validation is now green; `marketing-research` is available as a contract-checked module, with research runs still approval-gated
- managed deploy/Hermes/business-operator runtime claims should stay pilot-only until end-to-end runtime proof is green

## Status Legend
- **Done:** implemented and locally verified in this audit.
- **Mostly Done:** implementation exists, with smaller launch/readiness cleanup.
- **Partial:** real work exists, but the public promise would overstate current proof.
- **Open:** not implemented or not ready.
- **Not Verifiable Here:** likely lives in another repo/service or needs external credentials/users.

## Current Evidence Snapshot
| Area | Status | Evidence |
|------|--------|----------|
| Create package | Mostly Done | `create-microservices-app@0.4.3`; unit tests pass 15/15; smoke test passes; package bundles 7 templates. |
| Create package version display | Done | Fixed stale hard-coded `0.2.6`; `--help` now prints `0.4.3`. |
| Template registry | Mostly Done | Registry build reports 7 templates. `booking-sveltekit`, `client-portal-sveltekit`, and `erp-shell-sveltekit` pass targeted spec checks. |
| Module registry | Done | Full `spec:check:all` passes across 28 modules and 7 templates. |
| Booking module | Done | `@microservices-sh/booking` build passes; 41 tests pass; spec policy updated to match current Drizzle overlap checks. |
| Project-local SvelteKit shims | Done | `workspace-tools shims check --json` reports all known SvelteKit shims in sync. |
| Standalone MCP | Mostly Done | Local promotion docs say npm, official MCP Registry, and Smithery are live; directory PRs remain open/blocked depending on directory. |
| Root CLI | Partial | `modules list` is useful, but `templates list` only returns old `booking-business`; `deploy preview booking-sveltekit --plan` cannot resolve the modern template. |
| Managed deploy | Partial | Generated project shims expose preview/provision/upload/status commands, but old implementation notes and root CLI checks still mark Worker upload/route activation as pending. |
| Hermes / Agent Center | Partial | CLI commands and ERP UI exist, but Hermes plan hit a remote 404 during audit; market as pilot/demo until runtime creation/status is proven live. |
| Video assets | Partial | HyperFrames demo is current-ish at 67.8 seconds; older `video-preview`, `video-demo`, and `video-os` still show `0.1.1` and `01:30`/90-second labels. |

## Roadmap Status: Plan 29

### Phase 0: Launch Readiness
| Item | Status | Evidence | Next Action |
|------|--------|----------|-------------|
| LP copy aligned to System Harness | Done | Landing-page repo was revised in the prior session; planning docs now use "Production foundations for AI-built Cloudflare apps" and `microservices.sh System Harness`. | Keep using `plans/29-lp-marketing-product-roadmap.md` as positioning source of truth. |
| Video updated for current package/MCP version and actual duration | Partial | `video-demo-hf` is 67.8 seconds, but older video directories still contain `0.1.1` and `01:30`. | Pick one canonical video asset; update or archive stale preview directories before HN/Product Hunt. |
| Quickstart proof path verified clean | Done | Packed artifact generated `booking-sveltekit` under `/tmp`; generated project check passed in 2.69s; install passed with registry access in 12.3s. | Run one final public npm version check after publish/tag. |
| Analytics events for CTA/copy/package/MCP/agency/signup | Partial | Landing layout has client event tracking and `data-event` hooks; API ingestion/analytics dashboard not verified here. | Verify event delivery in production analytics, not only client hooks. |
| Public docs page: What is System Harness? | Done | Added `docs/system-harness.md` and linked it from root/package docs. | Publish or mirror it on the website docs. |

Gate status: **not fully met**. The no-signup quickstart is close, but video/docs/version consistency still needs cleanup.

### Phase 1: Proof Workflow
| Item | Status | Evidence | Next Action |
|------|--------|----------|-------------|
| Generate app | Done | `create-microservices-app` smoke passes; repo templates are bundled. | Keep default on `booking-sveltekit`. |
| Inspect module contracts | Done | Generated project CLI and registry expose module docs/contracts; shims are in sync. | Make this step prominent in quickstart docs. |
| Add/plan payment | Mostly Done | Smoke output shows approval-gated payment add plan; payment module exists with secrets/resources/approvals. | Include the payment plan in the 3-minute proof script. |
| Run checks | Done | Targeted template specs pass and full `spec:check:all` now passes across 35 targets. | Keep this green in CI before launch. |
| Show failure caught or approval gate triggered | Mostly Done | Payment add plan and generated checks show approvals; docs/demo script can show it. | Record or document one clear failure/approval moment. |
| Create preview deploy plan | Partial | Generated project shims include preview plan commands; root CLI cannot plan `booking-sveltekit`. Public docs now de-emphasize root CLI and make the generated project CLI canonical. | Sync root CLI later if it must become public. |

Gate status: **partially met**. The local loop works; external demo credibility depends on cleaning the failed full spec and root CLI drift.

### Phase 2: Agency Pilot Hardening
| Item | Status | Evidence | Next Action |
|------|--------|----------|-------------|
| Agency-ready template | Mostly Done | `booking-sveltekit`, `client-portal-sveltekit`, `saas-starter-sveltekit`, and `erp-shell-sveltekit` exist; targeted specs checked for booking/client/ERP. | Pick one agency pilot template and make its docs/tests first-class. |
| Handoff/module docs inside generated projects | Mostly Done | Generated projects include `docs/llms.txt`, module docs, lockfiles, shims, and agent guides. Public package and template READMEs now use System Harness positioning and list the current templates. | Publish/mirror the updated docs to the website. |
| Smoke tests for generated routes/checks | Partial | Create smoke passes; targeted spec checks pass; not all generated route/browser smoke checks were run in this audit. | Add a launch CI matrix for default template route smoke. |
| Managed preview plan/status/log UX | Partial | Shims expose commands; root/managed path remains partially pending. | Prove one deploy plan/status/log flow end-to-end with a real preview id. |
| Workspace/API-key setup | Not Verifiable Here | CLI help has auth/account commands; control-plane/API repo is not in this checkout. | Verify against production API and docs. |
| Entitlement gates for hosted actions | Partial | Approval/entitlement language exists; billing/runtime enforcement not verified here. | Keep hosted actions beta-gated until auth/billing enforcement is shown. |

Gate status: **not met**. There is enough to recruit pilots, but not enough to claim a polished agency platform.

### Phase 3: Managed Deploy Reliability
| Item | Status | Evidence | Next Action |
|------|--------|----------|-------------|
| Upload adapter and binding rewrite | Partial | Generated shims include upload-plan/upload commands; older roadmap notes say Worker upload and route activation remain pending. | Make the deploy truth explicit: local Wrangler fallback vs hosted upload adapter. |
| D1/KV/R2 provisioning with approvals | Partial | Provisioning concepts and commands exist; live Cloudflare provisioning was not verified here. | Run one credentialed preview in staging. |
| Logs/status/disable/cleanup | Partial | CLI command surface exists; production control-plane flow not verified here. | Verify API status/log/cleanup against production. |
| Production confirmation and audit records | Partial | Confirmation gates and audit modules exist; live production audit trace not verified. | Do not market autonomous production deploys. |
| BYO API-token path documented before OAuth | Mostly Done | `plans/managed-deploy-oauth.md` and shims document BYO-token-first sequencing. | Add public docs if not already on the website. |

Gate status: **not met**. Keep managed deploy as preview/beta language until hosted upload/routing is proven.

### Phase 4: Business-Operator Pilot
| Item | Status | Evidence | Next Action |
|------|--------|----------|-------------|
| Agent Center and Hermes hosted-vs-BYO docs | Partial | ERP shell Agent Center files exist; Hermes CLI commands exist; remote Hermes plan returned 404. Added `docs/operator-pilot-boundary.md` to keep this private-pilot. | Verify runtime API before public claims. |
| Runtime creation/status beyond UI | Open/Not Verifiable | No successful Hermes runtime creation/status proof in this audit. | Verify or build the runtime API path before public claims. |
| Approval card persistence | Partial | Approval concepts exist in modules/UI; durable runtime path not verified. | Show one persisted approval lifecycle in demo data. |
| Audit trace for agent actions | Partial | Audit module exists; actual agent-runtime audit persistence not verified. | Connect Agent Center actions to audit records before selling operator lane. |
| Marketing Research README and cite-or-refuse flow | Mostly Done | Module now has available status, standard docs, schemas, OpenAPI, migration, package exports, reference UI metadata, an operator skill, and passes module/full spec checks. External fetches and AI-provider calls remain approval-gated. | Verify stable provider/service path and one real approval-gated cite-or-refuse workflow before stronger autonomous research claims. |
| Ads Manager write boundaries | Partial | Ads Manager module/docs are present and approval-gated, but files are dirty and provider write proof was not audited. | Keep v1 to plans/review unless provider write gates are tested. |

Gate status: **not met**. Use this lane for private discovery, not public homepage headline.

### Phase 5: Distribution Scale
| Item | Status | Evidence | Next Action |
|------|--------|----------|-------------|
| Docker/OCI MCP packaging | Partial | Promotion status tracks Docker MCP Registry PR; `.dockerignore` exists untracked. | Finish PR/listing only after package/security story is stable. |
| More directory listings | Mostly Done/Ongoing | Local status says official MCP Registry, npm, and Smithery are live; several PRs are open; some directories are self-service/blocked. | Keep directory status doc current with PR URLs/status. |
| Case studies from agency pilots | Open | No evidence of completed pilots/case studies in this repo. | Recruit 3 pilots before writing case studies. |
| Comparison/migration SEO pages | Mostly Done | Landing repo has compare/migration work from previous session. | Add one `AI app builder vs System Harness` section if not already live. |
| Small paid retargeting | Open | No proof of conversion tracking + activation metric. | Do not spend until quickstart completion/pilot application tracking is reliable. |

Gate status: **not met**. Distribution is ahead of activation proof; keep scaling organic and directory-led until conversion is measured.

## Older Engineering Roadmap Reconciliation
| Original Phase | Status | Notes |
|----------------|--------|-------|
| Phase 0 Product Shell | Mostly Done | LP, docs, demo assets, analytics hooks exist; launch gate still lacks public consistency and measured demand. |
| Phase 1 CLI-First App Creator Prototype | Mostly Done | Create package/project shims are real; root CLI is stale relative to the modern template registry. |
| Phase 2 Booking Template | Mostly Done | Booking SvelteKit and real booking/customer/payment modules exist; booking module tests pass. Browser and full external clean-machine checks remain useful. |
| Phase 3 Managed Cloudflare Preview Deploys | Partial | Planning and local command surfaces exist; hosted Worker upload/routing/provisioning need live proof. |
| Phase 4 Paid Beta | Partial/Open | Auth/billing concepts and commands exist, but paying customers, entitlement enforcement, and portal key UI were not verified here. |
| Phase 5 Expansion | Ahead Of Gate | Expansion templates/modules exist before Phase 4 proof. This is useful, but increases launch/docs/test burden. |

## Highest-Priority Fixes
1. Clean video assets before launch: remove/update stale `0.1.1`, `01:30`, and 90-second labels.
2. Sync root `@microservices-sh/cli` to the modern registry only if it must become a public surface; otherwise keep public demos on the generated project CLI.
3. Publish or mirror `docs/system-harness.md`, `docs/quickstart-proof.md`, and `docs/operator-pilot-boundary.md` to the website docs.
4. Prove one hosted staging preview end to end before changing deploy wording from planning/readiness to live deploy.
5. Verify one real Marketing Research provider/runtime workflow before promoting autonomous research-run claims.

## Verification Run
| Command | Result |
|---------|--------|
| `pnpm --filter create-microservices-app start -- --help` | Pass; reports `create-microservices-app 0.4.3`. |
| `pnpm --filter create-microservices-app test` | Pass; 15/15 tests. |
| `pnpm --filter create-microservices-app smoke` | Pass; framework smoke intentionally skipped without `--network`. |
| Packed artifact quickstart under `/tmp` | Pass; default `booking-sveltekit` generated and checked in 2.69s; install passed with registry access in 12.3s. |
| `pnpm --filter @microservices-sh/booking build` | Pass. |
| `pnpm --filter @microservices-sh/booking test` | Pass; 6 files / 41 tests. |
| `pnpm --filter @microservices-sh/template-booking-sveltekit check:spec` | Pass. |
| `pnpm --filter @microservices-sh/template-client-portal-sveltekit check:spec` | Pass. |
| `pnpm --filter @microservices-sh/template-erp-shell-sveltekit check:spec` | Pass. |
| `node packages/workspace-tools/src/index.js registry build --out /tmp/ms-roadmap-registry --json` | Pass; 28 modules, 7 templates. |
| `node packages/workspace-tools/src/index.js shims check --json` | Pass; all known SvelteKit shims in sync. |
| `pnpm --filter @microservices-sh/marketing-research build` | Pass. |
| `pnpm --filter @microservices-sh/marketing-research check:spec` | Pass. |
| `pnpm spec:check:all` | Pass; 28 modules and 7 templates, 35 targets. |
| `node packages/workspace-tools/src/index.js registry build --out /tmp/ms-publish-registry --json` | Pass; generated registry lists `marketing-research` as `available` with operator skill and approval metadata. |
| `git diff --check` | Pass. |

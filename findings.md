# Findings And Decisions

## Requirements
- Review the current microservices.sh plan with deeper scrutiny.
- Make sure the plan is good enough to start an MVP.
- Break the plan into multiple markdown files that can guide execution.
- Preserve the correction that users are not necessarily building SaaS; they may build booking systems, online stores, customer portals, internal tools, APIs, workflow apps, or SaaS products.
- Account for the intended Cloudflare-native, managed deployment model.
- Account for users bringing their own agents such as Claude, Codex, or Cursor.

## Research Findings
- Cloudflare Workers for Platforms is aligned with this product because it supports platforms that run customer-written or AI-generated code in isolated Workers, with dispatch namespaces, customer limits, observability, tags, and bindings to Cloudflare services.
- Cloudflare D1 is aligned for per-app or per-tenant SQL isolation because Cloudflare describes it as managed serverless SQLite with support for many databases, Worker access, backups/time travel, and query/storage-based pricing.
- Durable Objects fit stateful coordination needs such as booking slot locking, real-time updates, job coordination, websocket state, and strongly consistent per-entity state.
- MCP is the right agent protocol and distribution layer because it connects AI applications to external tools, data, and workflows. It should not be the first activation dependency; the MVP should start with a create package and project CLI so users see a working local app before MCP setup.
- The product should not compete primarily as a no-code builder, generic boilerplate, or connector marketplace. Its sharper wedge is verified modules plus managed runtime plus agent-readable contracts.
- Pricing should not be framed as a markup over raw Cloudflare hosting. Cloudflare direct pricing is low, so the value must be module verification, agent workflow, safe customization, managed deploys, usage controls, and upgrades.
- As checked on 2026-06-13, public pricing references show Cloudflare Workers Paid at a $5/month minimum, Workers for Platforms at $25/month, Cloudflare Pages Pro at $25/month monthly, and Vercel Pro at $20/month plus usage.
- Secondary marketing research now supports the category, competitor, and pricing frame, but not willingness to pay for the exact product. Primary interviews and paid pilot commitments are still required.
- Stack Overflow's 2025 AI survey supports the macro trend: broad developer AI usage plus low trust in AI output accuracy.
- Medusa and Composio show that agent-native developer infrastructure is already emerging, so microservices.sh needs sharper differentiation around broader business apps, managed Cloudflare, and verified modules.
- ShipFast shows willingness to pay for boilerplate/setup time savings, but also creates a strong substitute and price anchor.
- Assumption validation pass completed: macro AI adoption, trust gap, agent-native category movement, setup-pain WTP proxy, and Cloudflare feasibility are validated enough for discovery; agency WTP, managed-vs-BYO preference, booking as first template, exact pricing, and module trust remain primary-research tasks.
- MCP directories should be included in GTM and validation, but only after the create-app quickstart and MCP setup flow are installable and credible. Key surfaces checked: official MCP Registry, Glama, PulseMCP, and MCP.so.
- The honey bee net concept should be used as a neon green honeycomb module network, not as a literal bee brand. It supports the ICP by visualizing verified modules, safe boundaries, hooks, events, and deployable app composition.
- The backend runtime should follow the FavCRM `v2/api` pattern: TypeScript + Hono/OpenAPIHono on Cloudflare Workers, with `nodejs_compat` only where dependencies require it. The product should not be described as a normal Node.js server on Cloudflare.
- Create package, project CLI, and internal TypeScript SDK should be built in the MVP because they provide first activation, CI, debugging, and shared tool logic. Hosted MCP should follow as a parity interface over the same SDK. Local stdio MCP should follow hosted MCP. Dockerized MCP is useful for deterministic installs and enterprise/devcontainer workflows, but should not block the first MVP loop. Public SDK should wait until contracts stabilize.
- The MVP should be staged: validation shell first, agent-to-local generated booking app second, managed Cloudflare preview deploy third, and paid beta fourth. This prevents the team from building the full managed platform before proving demand and workflow trust.
- The first implementation scaffold now confirms that the agent surface can be local-first: a static module/template contract, shared SDK facade, and CLI can compose and generate a booking-business Worker without needing the managed deployment layer yet.
- Module docs must be broader than Swagger/OpenAPI. OpenAPI covers routes, payloads, and responses; the module contract must also cover secrets, env vars, resources, permissions, events, hooks, migrations, source ownership, approval gates, and upgrade policy.
- LLM accessibility is a product requirement. Module docs need stable paths, one Markdown file per module, a compact machine-readable catalog, predictable headings, fenced JSON examples, and future CLI/MCP access.
- Each module needs a standard package structure and safe `src/index.ts` entrypoint. Imports must be side-effect free; resource creation, third-party calls, migrations, and secret reads happen only through explicit runtime or deployment actions.
- Each top-level module concern should be a folder with its own `index.ts` re-export. The module root re-exports the approved public surface; leaf files should import from concern folders, not the root, to avoid circular imports.
- Third-party SaaS support should be implemented as full provider modules, not thin connectors. `payment-stripe` is the model: products, prices, checkout, payment links, webhooks, refunds, idempotency, schema, tests, and events.
- The source-code ownership default should be user-owned repos with branch/PR or patch workflows. microservices.sh can manage previews and approval gates without hiding source.
- The managed Cloudflare MVP namespace for generated app Workers is `microservices-sh`, used as the Workers for Platforms dispatch namespace.
- The create-app path is now scaffolded locally with `packages/create-microservices-app`, generated module docs, a project CLI, and update status checks. The create package now bundles the internal generator into `dist/index.js`, so the packed tarball has no runtime dependency on workspace-only `@microservices-sh/sdk-internal`.
- Current CLI auth is only a static bearer-token bootstrap: `auth login --api-key` stores a local key and the API validates it against Worker env vars.
- Real product billing should not be added before auth. Stripe customers, subscriptions, and deploy entitlements need reliable `workspaceId`, `ownerUserId`, `ownerEmail`, and scoped CLI/API identity.
- For this use case, opaque D1-backed portal sessions plus workspace-scoped D1 API keys fit better than long-lived JWT-first auth. JWTs can be added later only as short-lived access tokens if stateless API calls become necessary.
- The first API auth slice now establishes D1 auth tables, workspace-scoped API-key identity, internal static-key compatibility under `ws_internal`, workspace-scoped control-plane queries, and MCP identity propagation. Billing is still blocked until remote D1 migration/backfill, first-owner key bootstrap, CLI profiles, portal sessions, and cross-workspace tests are complete.
- The standalone MCP package is now the right distribution unit for agent directories: `@microservices-sh/mcp` exposes local stdio install via npm, while `https://api.microservices.sh/mcp` gives remote Streamable HTTP catalogs a hosted endpoint.
- Official MCP Registry submission uses `server.json` and `mcp-publisher`, not a PR. `sh.microservices/mcp` is now published through domain-authenticated DNS ownership of `microservices.sh`.
- High-value public MCP listing routes are now covered by PRs to Awesome MCP Servers, MCPFind, MCPSvr, and Docker MCP Registry. PulseMCP, MCP.so, Glama, and Smithery remain self-service/account-driven; Smithery must not be published from the current `favcrm` namespace.
- Docker MCP Registry is a good fit for the hosted remote endpoint after API-key auth, while local stdio discovery is better served by npm/package-based directories.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Build a headless-first platform | User intent is to work inside existing agents, not a large dashboard. |
| Provide a minimal control-plane UI | Needed for billing, profile, keys, connected accounts, usage, projects, and deployment visibility. |
| Use managed Cloudflare first, BYO Cloudflare later | Managed mode reduces activation friction; BYO is useful for advanced/compliance users after core value is proven. |
| Use one vertical template as the MVP | Reduces scope and creates a concrete validation workflow. |
| Use customization tiers: config, hooks, fork/export | Balances flexibility, supportability, and upgradeability. |
| Price by managed apps/projects first | Aligns pricing with delivered value and avoids confusing customers with raw infrastructure metering. |
| Start public beta pricing at Builder $49/month, Pro $99/month, Agency $299/month | Keeps microservices.sh out of the commodity hosting price frame while remaining accessible for early users. |
| Use TypeScript + Hono/OpenAPIHono on Cloudflare Workers as the runtime baseline | Creates inspectable route modules for agents while staying aligned with Workers bindings, D1, KV, R2, Queues, Durable Objects, and service bindings. |
| Build create package, project CLI, hosted MCP, and internal SDK before Dockerized MCP or public SDK | Gives broad agent compatibility while keeping core logic centralized and avoiding premature SDK support burden. |
| Build create package and project CLI before treating MCP as first activation | Creates a familiar `pnpm create microservices-app` path and lets users inspect a local app before account, Cloudflare, or MCP setup. |
| Keep published create-app distribution self-contained or backed by public packages | A package with workspace-only internal dependencies is fine for monorepo smoke tests but not acceptable for npm distribution. |
| Stage the MVP before full managed runtime buildout | Validates demand, module trust, and agent workflow before committing to the expensive platform layer. |
| Keep CLI/MCP behavior behind one SDK facade | Prevents drift between local agent workflows and the future hosted MCP/control-plane implementation. |
| Use standard module package structure | Gives agents predictable entrypoints, folder responsibilities, and safe customization boundaries. |
| Use folder-level barrel exports | Keeps module import paths stable for agents while allowing implementation files to grow. |
| Use full provider modules for third-party SaaS | Makes integrations valuable because they include business workflow logic, not just credentials. |
| Use `microservices-sh` as the managed dispatch namespace | Gives the Cloudflare preview adapter a concrete Workers for Platforms target. |
| Implement auth before billing | Payment state must attach to a trusted workspace and owner before it can unlock deploy/provision/domain entitlements. |
| Use D1-backed API keys for CLI/MCP | Agents, CI, and terminal workflows need stable revocable credentials with scopes, prefixes, and workspace context. |
| Use opaque server-side sessions for the admin portal | Sessions stored as D1 hashes can be revoked and rotated; secure HttpOnly cookies avoid browser token storage. |
| Make migration analysis agentic but CLI-deterministic | The CLI should generate versioned checklist/prompt files, validate an external agent's JSON report, render doctor output, and generate next prompts without bundling an AI service. |
| Treat Cloudflare enablement as staged migration | Existing projects such as Vite React apps with Supabase should first become Cloudflare-hosted/hybrid, then migrate functions/storage/data only when evidence shows it is safe. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| The earlier positioning over-indexed on SaaS apps | Reframed category as agent-native application infrastructure for production apps/business systems. |
| The phrase "verified Cloudflare" was imprecise | Reframed to "verified Cloudflare-native modules" and "managed Cloudflare deployment". |
| The plan could become too broad | Added strict MVP non-goals and success gates. |

## Resources
- Cloudflare Workers for Platforms: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- Model Context Protocol overview: https://modelcontextprotocol.io/docs/getting-started/intro
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Workers for Platforms pricing: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/
- Cloudflare D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare Pages pricing: https://pages.cloudflare.com/
- Vercel pricing: https://vercel.com/pricing
- GitHub Octoverse 2024: https://github.blog/news-insights/octoverse/octoverse-2024/
- Medusa: https://medusajs.com/
- Composio pricing: https://composio.dev/pricing
- ShipFast: https://shipfa.st/
- Cal.com pricing: https://cal.com/pricing
- Official MCP Registry: https://github.com/modelcontextprotocol/registry
- Glama MCP Directory: https://glama.ai/mcp
- PulseMCP: https://www.pulsemcp.com/
- MCP.so: https://mcp.so/
- Cloudflare Hono framework guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/
- Cloudflare Node.js compatibility docs: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Hono Cloudflare Workers guide: https://hono.dev/docs/getting-started/cloudflare-workers
- MCP transports: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
- MCP debugging and local stdio setup guidance: https://modelcontextprotocol.io/docs/tools/debugging
- Official MCP Registry publishing quickstart: https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx
- Official MCP Registry authentication: https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/authentication.mdx
- Docker MCP Registry: https://github.com/docker/mcp-registry
- Awesome MCP Servers: https://github.com/punkpeye/awesome-mcp-servers
- MCPFind: https://github.com/MCPFind/mcp-find
- MCPSvr: https://github.com/nanbingxyz/mcpsvr
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OAuth 2.0 Device Authorization Grant, RFC 8628: https://www.rfc-editor.org/rfc/rfc8628

## Visual/Browser Findings
- Cloudflare Workers for Platforms docs state that it is for multi-tenant platforms running untrusted customer or AI-generated code in secure isolated sandboxes.
- Workers for Platforms docs list features relevant to this product: custom limits, observability, tags, user Workers, dynamic dispatch Workers, bindings, and custom hostnames.
- D1 docs describe serverless SQL databases queryable from Workers and Pages, with SQLite semantics and isolation-friendly database creation.
- Durable Objects docs describe stateful applications, strongly consistent storage, unique object identity, and coordination among clients.
- MCP docs describe MCP as an open standard for connecting AI applications to external systems, including tools and workflows, with support across clients such as Claude, ChatGPT, VS Code, and Cursor.

## DOT AI OS Template Findings
- `create-microservices-app` has three template modes: repo-style bundled templates, procedural SDK templates, and framework starters from `frameworks.json`.
- `dot-ai-os` should be a repo-style bundled product template, not a framework starter; users should run `--template dot-ai-os` only.
- Repo-style templates are hardcoded in `packages/create-microservices-app/src/index.js#REPO_TEMPLATES` and copied by `packages/create-microservices-app/scripts/build.js#REPO_TEMPLATES`.
- The build script must copy every local module that appears in the template package dependencies after dependency rewriting, or generated apps will reference missing `file:./modules/<id>` packages.
- `calendar-google` exists as a module and is now listed in the create CLI `BUNDLED_MODULES` allowlist so `dot-ai-os` can advertise it as a planned optional integration.
- Modern web guidance retrieved for the dashboard implementation emphasized semantic forms, visible labels, focus-visible states, stable grid/flex layouts, `100dvh` over brittle viewport units, and avoiding unnecessary offscreen rendering work above the fold.

## DOT AI OS Revamp Findings
- Modern web guidance search for the revamp surfaced `css-layout` as the most directly relevant guide for the dense operator dashboard/app-shell work. `fluid-scaling` may be useful for container-bound panes, but font sizes should not scale with viewport width in this repo's design rules.
- Current worktree has unrelated dirty changes in promotion docs, org-team-rbac, and ERP shell team/signup routes. Treat those as user/other-agent changes and avoid modifying them during the `dot-ai-os` revamp unless they block verification.
- Upstream `/tmp/jimmy-dashboard-OS` is aligned with `origin/main` at commit `705f287` ("Add Agent OS team dashboard").
- Current upstream stack is Vite + React + Express + SQLite, with Vercel/Railway deployment artifacts and a Supabase schema/export path. The revamp should port product concepts, not server/runtime coupling.
- Upstream product scope: Tasks, Calendar, Focus Plan / today's schedule, Daily Unlock / Review, AI task intake, AI Focus Plan / Daily Review rewrites, local persistence, inbox import, Google Calendar read/sync, Knowledge URL import, Hermes token ingestion, and Obsidian-ready markdown export.
- Upstream design direction is "Clear Workbench": calm, direct, dense, readable, familiar product UI. Avoid decorative focus modes, landing-page composition, oversized hero cards, nested-card complexity, black showcase panels, and novelty interactions.
- Upstream key UX anchor: the timeline/day plan remains stable while secondary panels collapse or disclose progressively.
- Revamp decision: adapt the upstream product surfaces into a Cloudflare-native microservices.sh template, not a direct Vercel/Supabase/Express/SQLite port. The template keeps durable provider behavior behind modules and explicit approval gates.
- `templates/dot-ai-os/src/lib/os-data.ts` now owns starter UI contract data only. Production task/content/knowledge persistence should move into a module use case or a documented D1 table before real external ingestion/write-back is enabled.
- The revamp validation passed template spec checks, SvelteKit app build, create-package build, local generated-app creation, generated-app contract checks, create-package tests, whitespace checks, and CSS guard searches.

## DOT AI OS Agentic Operator Work Findings
- The next durable slice should be an `operator-work` module because tasks, focus blocks, and daily reviews are the core context that AI agents need before calendar, knowledge ingestion, or publishing integrations are useful.
- Agentic write access should be exposed through explicit module use cases, not direct table/file edits. Every write should accept an `actorId`/`source` and be auditable by the template.
- External side effects remain out of scope for this slice: no Google Calendar write-back, AI provider calls, Obsidian export, or CMS/social publishing without a later approval module.
- The central module catalog now needs to carry agentic surfaces, not only routes and dependencies, so CLI/SDK/MCP docs can tell agents which tools are read-only and which require approval.
- `operator-work` should stay `draft` while the local D1/memory use cases mature, but it is still useful in the contract catalog so generated DOT AI OS apps have an inspectable operator-work tool map.
- Workspace registry and discovery need to expose module `surfaces`, `referenceUi`, and `skillFiles` so agents can plan admin UI wiring, visitor surfaces, and approval-gated tool use without scraping individual module folders.
- Create-app needs a first-class Corporate OS onboarding flag so users can create `dot-ai-os` as a company-specific operating system, not just as another generic template. The intake should write durable company, workflow, research, decision, and pilot docs that agents can read before making changes.

## Agentic Admin And Visitor Template Findings
- `saas-starter-sveltekit` was marked ready while still using direct demo sessions in `/login`; production readiness requires identity-owned sessions and passwordless email-code verification.
- `client-portal-sveltekit` must support real visitor/customer login in production; a fail-closed production login is safer than demo auth but does not satisfy the agentic visitor-use requirement.
- Client portal file visibility must be customer-scoped, not tenant-wide. The cleanest module-level fix is to make file/media records optionally owner-scoped so portals can filter by authenticated customer without template-local string filtering.
- The WordPress/EmDash template build instability appears tied to the Cloudflare Vite plugin attempting local network-interface inspection during workspace builds; the fix should avoid fake success and preserve Cloudflare adapter behavior.

## Latest Marketing/Product Update Review Findings
- The latest updates move the product beyond "dev tool plus MCP" into two clearer lanes: a developer launch lane (`create-microservices-app`, local checks, MCP Registry) and a business-operator lane (ERP shell, Agent Center, Hermes runtime, ads workflows, marketing research, approval gates). Keep these lanes distinct in launch copy so the public promise does not outrun the implemented runtime.
- The strongest public wedge remains the 70/30 framing: agents can generate UI quickly, but production foundations fail around auth, billing, tenancy, migrations, audit logs, deploys, and approvals. The refreshed CLI/MCP video storyboard now expresses that better than the earlier directory-first story.
- The OS narrative is promising but should be treated as a pilot story, not the first broad public promise. `video-os` frames microservices.sh as a private company operating layer for operating, researching, advising, and governing. That is directionally valuable, but it depends on real agent runtime, real internal/external research inputs, real approval flows, and audit persistence.
- The ERP Agent Center creates a much stronger product surface than module catalogs alone: role-specific operators, scoped tools, held approvals, trace, runtime settings, and Fly/OpenRouter runtime status. This supports the "business operators with approval gates" story. Until Hermes is truly provisioned end-to-end, this page should be positioned as reference/demo UI rather than live capability.
- Hermes CLI commands create a new monetizable SKU candidate: hosted managed agent runtimes with billing gates, plus BYO Fly setup for users who want control. This supports a sharper paid-beta offer, but docs need to explain the hosted-vs-BYO decision path and avoid making Fly setup look like a hidden prerequisite for the core CLI/MCP path.
- Ads Manager has shifted from passive monitoring to an agentic operator workflow: performance review, offline copy drafts, and approval-ready publish plans. This is valuable because it gives non-developer business users something concrete to ask agents for. The boundary language is correct: v1 must not imply it can create, schedule, publish, pause, or change budgets without a separate write-capable provider tool.
- Marketing Research now has a dev preview for cite-or-refuse and coverage-honest briefs. That is an important differentiator for the "research/advice" lane because it directly addresses trust in agent output. It should not be marketed as production until the local `last30days` dependency is packaged or replaced by a stable product service.
- Login and team updates improve business-product credibility: passwordless login now handles "signed in but not invited" cleanly, team management is moving toward dense operator UI, and reusable table/select components reduce template friction. These changes support agency/internal-tool use cases more than generic developer-tool positioning.
- The current video assets need cleanup before external launch: `video-preview`, `video-demo`, and `video-os` still contain stale MCP version text (`0.1.1`) even though npm and the official MCP Registry are at `0.1.3`, and the player labels still say `01:30`/`90` seconds while the revised timeline ends at 77 seconds. This can look sloppy in HN/Product Hunt scrutiny.
- Revised GTM recommendation: launch the developer lane first with Show HN and MCP directories using "production foundations for agent-built Cloudflare apps"; separately recruit pilots for the business-operator lane using the ERP Agent Center, Ads Manager, Hermes runtime, and marketing-research demos. Do not combine both into one public launch headline yet.

## Marketing Skills Validation And Revised Positioning Findings
- Skill audit: this checkout has an empty `./.agents/` directory and no local `.agents/product-marketing.md`; validation used installed marketing skills (`social`, `paid-ads`) plus repo-local product skills under `skills/` and `modules/*/skills`. The marketing skills support a sharper channel plan and hook discipline, while the repo-local skills validate that public claims must stay tied to contracts, lockfiles, module docs, local checks, approval gates, and plan-first deploys.
- Category validation: AI app builders already own "prompt to app." Lovable says users create apps and websites by chatting with AI, then refine and deploy; Bolt claims apps/websites by chatting with AI plus built-in hosting, databases, auth, SEO, and custom domains; Replit Agent says it turns ideas into apps and handles planning through deployment; v0 says it creates real code, full-stack apps, and production deploys. microservices.sh should not lead as another AI app builder.
- Platform validation: Supabase and Firebase own backend primitives and managed app infrastructure. Supabase is a Postgres development platform with Auth, APIs, Edge Functions, Storage, Realtime, and vector embeddings; Firebase positions as services for building and running apps with speed, security, and scale. microservices.sh should position above primitives: an agent-readable system harness that composes, checks, and governs Cloudflare-native business-app foundations.
- Agent-runtime validation: Cloudflare Agents now explicitly offers durable agent identity, local SQL storage, real-time connections, scheduled work, recoverable execution, MCP, Browser, Sandbox, AI Search, and Payments. That supports the Hermes/ERP-shell direction, but also raises the bar: the business-operator lane needs real durable runtime proof before broad launch.
- Agent-tools validation: Composio owns the "tools for agents" category with managed OAuth, intent-resolved tools, guardrails, and programmatic execution. microservices.sh should avoid connector-marketplace positioning; its wedge is domain modules, source-visible app foundations, and production approval boundaries.
- Trust-gap validation: Stack Overflow's 2025 survey says 84% of respondents use or plan to use AI tools, but 46% distrust AI accuracy while only 3.1% highly trust it. The largest AI frustration is "almost right, but not quite" at 66%; 75.8% do not plan to use AI for deployment and monitoring. This strongly supports the "agents build fast, but production needs a harness" story.
- HN validation: Show HN is only a fit if people can try the thing, ideally without signup/email, and not if it is only a landing page or reading material. The Show HN target should be the CLI/create-app path with a copy-paste command, public repo, docs, and a short demo, not the abstract OS pitch.
- Recommended public one-liner: "Production foundations for AI-built Cloudflare apps." Recommended explanatory category: "microservices.sh System Harness is a contract-driven development environment for agent-built apps." Use `System Harness` as the category phrase; avoid leading with "Harness" alone because it can sound like an external-service integration and may collide with the existing Harness.io mental model.
- Revised ICP: primary users are AI-heavy technical founders, agencies, fractional CTOs, and Cloudflare-oriented developers building client portals, booking flows, internal tools, and SaaS MVPs where auth, tenancy, billing, audit, migrations, and deploys matter. They already use Claude/Codex/Cursor/Replit/v0, but want source ownership and fewer production mistakes. Secondary users are business operators/ops leads, but only through pilots around ERP shell, Agent Center, Ads Manager, Hermes, and cited research.
- Revised production positioning: do not claim "we replace Lovable/Bolt/Replit/v0." Claim "use any coding agent, but give it a governed production substrate." The clearest mental model is: app builders generate; microservices.sh harnesses. Backend platforms provide primitives; microservices.sh packages agent-readable business modules and checks. Agent tool platforms connect tools; microservices.sh governs app foundations and side effects.
- Product-development priority: the next externally useful proof is one end-to-end, no-handwaving workflow: `npm create microservices-app@latest`, inspect module contracts, run checks, show one risky change caught or approval-gated, then create a preview deploy plan. This is more valuable than adding more modules before trust is established.
- Business-operator lane priority: keep Agent Center/Hermes as a pilot narrative until hosted-vs-BYO docs, billing gates, runtime creation, audit persistence, and approval cards are end-to-end. The ERP Agent Center copy can say "reserved/scoped/held for approval"; it should not imply autonomous production writes.
- Marketing Research is now an available contract-checked module with cite-or-refuse behavior, a top-level README, reference UI metadata, and an operator skill. External signal fetches, AI-provider calls, migrations, and production deploy behavior remain approval-gated, so market it as governed cited research rather than autonomous research.
- Paid acquisition should wait. The paid-ads skill check says conversion tracking, landing page speed, mobile fit, UTMs, and funnel value must be ready before spend. For now, use organic developer channels: MCP directories, HN, X/LinkedIn founder posts, direct founder/agency outreach, and community replies where people are already discussing AI-built production-app failures.
- Social/content angle: lead with concrete failure prevention, not generic AI productivity. Strong hooks: "Agents are good at the first 70%; production breaks in the last 30%," "Stop asking your agent to invent auth and billing," and "Use any coding agent, but give it contracts, checks, and approval gates."
- Launch copy review: `docs/promotion/launch-copy.md` is aligned with the revised positioning. The HN draft should include a try-it-now command and a short proof path above the MCP Registry detail, because HN feedback will center on whether the project is runnable and non-trivial.
- Video asset review remains a blocker before broad launch: current non-HyperFrames video previews still contain stale `0.1.1` MCP text and `01:30`/90-second labels, while npm and the official MCP Registry report `@microservices-sh/mcp` / `sh.microservices/mcp` latest as `0.1.3` and `video-demo-hf/index.html` uses a 71-second composition. Clean the version/duration mismatch before HN, Product Hunt, or paid retargeting.
- Sources checked: Lovable (`https://lovable.dev/`), Bolt (`https://bolt.new/`), Replit Agent docs (`https://docs.replit.com/references/agent/overview`), v0 docs (`https://v0.app/docs`), Supabase (`https://supabase.com/`), Firebase (`https://firebase.google.com/`), Cloudflare Agents (`https://developers.cloudflare.com/agents/`), Composio (`https://composio.dev/`), Stack Overflow Developer Survey 2025 AI section (`https://survey.stackoverflow.co/2025/ai`), HN Show HN guidelines (`https://news.ycombinator.com/showhn.html`), npm (`npm view @microservices-sh/mcp version`), and official MCP Registry API (`https://registry.modelcontextprotocol.io/v0.1/servers?search=sh.microservices/mcp`).

## Landing Page Audit And Roadmap Findings
- Landing page audit result: the site already had the right ingredients, but the product promise was too module-first. The revised public frame is `microservices.sh System Harness`: a contract-driven development environment for agent-built apps.
- The homepage, quickstart page, agency page, pricing page, compare page, writing index, footer, nav CTA, and landing repo README were revised so "verified modules" are proof and CLI/MCP are access surfaces. The headline promise is now "Production foundations for AI-built Cloudflare apps."
- The most important LP fix beyond copy was navigation: the shared nav CTA now links to `/#quickstart`, so "Start a project" works from secondary pages instead of targeting a missing local anchor.
- Use `System Harness` as a branded phrase with `microservices.sh` attached. Cloudflare's current Agents docs also use agent-harness language, which validates the category but makes specificity important.
- Developer launch should use the no-signup quickstart as the primary proof. HN Show HN should wait until the quickstart, video, docs, and version labels are consistent because HN explicitly expects something runnable, not a landing page.
- Agency pilot is still the strongest monetization lane. The public LP can invite agencies, but direct outreach should ask about repeated client portals, booking/customer/payment apps, and production handoff risk.
- Business-operator/ERP/Hermes language should remain a private pilot lane until durable runtime creation, billing gates, approval-card persistence, and audit traces are demonstrably end-to-end. Marketing Research can be public as governed cited research, but not as ungated autonomous research.
- Paid acquisition should wait until conversion tracking and activation metrics are reliable. The recommended first paid motion is small retargeting only after organic traffic proves quickstart completion or pilot applications.
- New source of truth: `plans/29-lp-marketing-product-roadmap.md`.

## Product Roadmap Status Audit Findings
- The product has materially passed the "only planning" stage: `create-microservices-app` builds and smokes successfully, bundles 7 templates, targeted specs pass for booking/client-portal/ERP templates, registry build reports 28 modules and 7 templates, and the booking module build/test suite is green.
- The create package had a launch-trust bug: `package.json` was `0.4.3`, but `--help` printed `0.2.6`. The CLI now reads its own package version and prints `create-microservices-app 0.4.3`.
- The booking module spec policy had drifted from the implementation: the D1 adapter now uses Drizzle `lt(...)`/`gt(...)` interval-overlap expressions rather than the old raw SQL text. The policy was updated and booking build/tests pass.
- Full workspace spec validation is now green. The previous blocker in `modules/marketing-research` was resolved by adding required module files, standard exports, reference UI metadata, an operator skill, and available catalog status.
- The developer proof workflow is mostly real: generate app, inspect module docs, plan payment with approval gates, run local checks, and create deploy plans exist through the create package/project shims. The remaining launch risk is public coherence, not absence of implementation.
- Root `@microservices-sh/cli` is behind the modern create-package registry. It lists only `booking-business`, while the create package bundles 7 templates. Do not use the root CLI template list as the public launch path until it is synced.
- Managed deploy should stay beta language. Generated project shims expose preview/provision/upload/status/log commands, but hosted Worker upload, route activation, and credentialed production preview were not verified in this repo.
- Business-operator features are promising but pilot-only. ERP Agent Center, Hermes, and Ads Manager support the System Harness story, but Hermes runtime planning hit a remote 404. Marketing Research now passes module contract validation and can be positioned as approval-gated cited research.
- Video assets remain a concrete launch blocker: `video-demo-hf` has a 67.8-second composition, but older preview/demo/OS video directories still contain stale `0.1.1` MCP text and `01:30`/90-second labels.
- The next execution source of truth is `plans/30-product-roadmap-status-audit.md`, which marks each Phase 0-5 roadmap item as done, mostly done, partial, open, or not verifiable.

## Launch Docs And Quickstart Execution Findings
- Public docs now define the product as `microservices.sh System Harness`, not as a SaaS boilerplate. `README.md`, `packages/create-microservices-app/README.md`, `docs/llms.txt`, and `templates/README.md` were updated around source-visible modules, local contracts, lockfiles, checks, and approval-gated plans.
- The canonical public CLI path is now explicit: `create-microservices-app` generates the app, and the generated project CLI (`<pm> microservices`) is the launch/demo surface. The root `@microservices-sh/cli` workspace package remains internal until its catalog is synced with create-package templates.
- Managed deploy claims were narrowed to deploy planning/readiness. Public docs now avoid implying that hosted Worker/assets upload and route activation are already verified live.
- Agent Center, Hermes runtime, and Ads Manager are documented as private-pilot/demo surfaces. They should not be the public launch headline until runtime creation/status, approval persistence, audit trace, billing gates, and provider write gates are proven. Marketing Research is available as a governed cited research module with approval-gated provider actions.
- A clean quickstart proof from a packed `create-microservices-app@0.4.3` artifact passed under `/tmp`: generate default `booking-sveltekit`, run generated project `microservices check --json`, read module contracts, and run `add payment --plan --json`.
- Time from extracted package artifact to generated app `microservices check`: 2.69 seconds with `--no-install --no-git`. A real dependency install then succeeded with network access in 12.3 seconds. Offline install failed on a cold store because `@cloudflare/workers-types` was missing, which is expected without npm cache.
- New docs added: `docs/system-harness.md`, `docs/operator-pilot-boundary.md`, and `docs/quickstart-proof.md`.

## Marketing Research Contract Completion Findings
- `modules/marketing-research` now has the standard module contract surface: `README.md`, `README.agent.md`, `llms.txt`, `openapi.json`, JSON schemas, D1 migration, required package exports, reference UI metadata, an operator skill, and the required `src/*/index.ts` concern folders.
- The module is now `available` for catalog/listing use. Keep external-signal fetches and AI-provider calls approval-gated until the provider/runtime path is verified with one real cite-or-refuse workflow.
- `pnpm --filter @microservices-sh/marketing-research build` passes.
- `pnpm --filter @microservices-sh/marketing-research check:spec` passes.
- `pnpm spec:check:all` now passes across 28 modules and 7 templates, 35 targets total. The previous full-spec blocker is resolved.

## StackSuite Accounting And Commerce Port Findings
- Donor app behavior from `accounting-system` and `invoice-system-bao` maps cleanly into module boundaries rather than copied full apps: product catalog, inventory, sales order, shipment, commerce sync, accounting core, accounts payable, accounts receivable, and bank reconciliation.
- The module extraction is implemented and contract-checked. `erp-shell-sveltekit` now carries the StackSuite module migrations and optional slots.
- `commerce-ops-sveltekit` and `accounting-erp-sveltekit` are now repo-style create-app templates with focused manifests, lockfiles, enabled-module sets, and StackSuite-specific agent docs.
- Route-level StackSuite pages now exist in the focused templates: commerce has products, inventory, sales orders, shipments, and commerce sync; accounting has ledger, payables, receivables, and banking.
- The new templates intentionally keep inherited ERP shell code and broad package deps for now because the SvelteKit route layer still imports shared stores and dashboard behavior. Pruning inherited deps/migrations is now the remaining template-hardening work.
- Accounts receivable, bank reconciliation, and commerce sync now expose async store-backed service factories while preserving their synchronous in-memory services for existing local callers.
- Bank reconciliation has memory and D1 store adapters against its existing migration tables for accounts, statement transactions, matches, and reconciliation sessions.
- Accounts receivable now has memory and D1 store adapters. The D1 migration owns `ar_invoice_snapshots`, `ar_customer_payments`, and `ar_payment_applications`; invoice snapshots are reporting snapshots while the invoice module remains the invoice system of record.
- Commerce sync now has memory and D1 store adapters. The D1 migration owns provider connections, mappings, sync runs, webhook receipts, and normalized commerce envelopes with JSON payload persistence.
- The focused accounting template now uses D1-backed receivables, bank reconciliation, accounting core, and AP stores when a DB binding exists, with memory fallbacks for local development.
- The focused commerce template now uses the D1-backed commerce sync store when a DB binding exists. Local development seeds a Shopify connection, sync run, mapping, and webhook receipt through the same service so the page reads persisted module state.

## Broader StackSuite Adoption Findings
- The remaining StackSuite apps have value, but mostly as module/workflow donors rather than full templates. The strongest net-new module candidate is `sms-campaigns`, based on `sms-crm` contacts, groups, templates, provider configs, campaigns, recipients, and delivery logs.
- `sms-campaigns` is now implemented as a contract-checked module with memory and D1 stores, consent-aware campaign creation, scheduled dispatch selection, delivery callback reconciliation, idempotent vendor-message updates, tests, and a migration smoke check. A focused `sms-crm-sveltekit` template should wait until a route proof is needed.
- HelpGrid shows the next support gap: widget settings, quick actions, conversations, messages, ticket comments, ticket attachments, pending attachments, share tokens, WhatsApp channel metadata, and analytics. This should harden `support-ticket`, `knowledge-base-rag`, and possibly a separate `support-inbox`; do not put ungated grounded replies back inside the ticket module.
- `support-inbox` is now implemented as the separate HelpGrid widget/conversation module, avoiding the active `support-ticket` and `knowledge-base-rag` edits. It owns widget settings, quick actions, conversations, messages, channel connection metadata, and agent takeover; ticket CRUD/escalation remains in `support-ticket`, and grounded answers remain in `knowledge-base-rag`.
- Booking variants add a useful membership/credits domain: membership tiers, customer memberships, customer credit balances, credit transactions, and membership history. This should become a booking/customer/payment add-on module rather than being embedded in the booking core.
- `membership-credits` is now implemented as a contract-checked module with memory and D1 stores for tiers, customer memberships, credit balances, credit ledger transactions, and membership history. It intentionally stores money in integer cents, blocks overdrafts, and makes booking credit application/refund operations idempotent by reference.
- Accounting variants add estimates/quotes with accept/decline/convert lifecycle, recurring invoice templates, and send/post/void document APIs. `estimate-quote` is implemented as a contract-checked module with memory and D1 stores, integer-cents line totals, expiry, voiding, and invoice-conversion handoff metadata. `recurring-documents` is now implemented for recurring invoice/bill templates, due-cycle generation, pause/resume/cancel lifecycle, integer-cents totals, and draft document handoff payloads.
- DashDrive contributes a focused storage entitlement pattern: expiring share links, short public ids, download counts, storage packages, and one-time purchases. This should extend `file-media` via a `storage-entitlements` module rather than replacing the existing upload-ticket design.
- `storage-entitlements` is now implemented as a contract-checked module with owner-scoped storage accounts, quota accounting, storage packages, idempotent purchase completion, expiring share links, revocation, and download counts. It intentionally leaves byte upload and R2 URL signing to `file-media` or app adapters.
- HR System is now implemented as `hr-people-ops`, a contract-checked module covering employees, departments, positions, leave balances/requests, and attendance. It stores leave balances as integer hundredths of a day and intentionally excludes payroll, benefits, tax, auth/session tables, and complex scheduling.
- `url-shortener` is now implemented as a contract-checked utility module with tenant-scoped links, URL validation, custom/reserved aliases, expiry, deactivation, redirect resolution, click analytics, and D1/memory stores. KV redirect caching remains an app-adapter concern.
- Remaining utility apps such as QR generator, document renderer, HTML renderer, CMS/blog/magazine, web builder, and video maker should stay P2/free-tool candidates until the System Harness quickstart and focused templates are cleaner.
- New source of truth: `plans/35-stacksuite-broader-adoption-plan.md`.

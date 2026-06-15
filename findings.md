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
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OAuth 2.0 Device Authorization Grant, RFC 8628: https://www.rfc-editor.org/rfc/rfc8628

## Visual/Browser Findings
- Cloudflare Workers for Platforms docs state that it is for multi-tenant platforms running untrusted customer or AI-generated code in secure isolated sandboxes.
- Workers for Platforms docs list features relevant to this product: custom limits, observability, tags, user Workers, dynamic dispatch Workers, bindings, and custom hostnames.
- D1 docs describe serverless SQL databases queryable from Workers and Pages, with SQLite semantics and isolation-friendly database creation.
- Durable Objects docs describe stateful applications, strongly consistent storage, unique object identity, and coordination among clients.
- MCP docs describe MCP as an open standard for connecting AI applications to external systems, including tools and workflows, with support across clients such as Claude, ChatGPT, VS Code, and Cursor.

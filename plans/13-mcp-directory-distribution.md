# MCP Directory Distribution Plan

Generated: 2026-06-13

## Recommendation
Yes, microservices.sh should publish to MCP directories, but not before the MCP surface is real enough to install and test.

MCP directories are a good fit because the product is agent-native, but they should not be the first activation dependency. The first meaningful user action should be running `npm create microservices-app@latest` or `pnpm create microservices-app`, then using the generated project CLI. Claude, Codex, Cursor, and similar developer agents remain part of the broader product story through CLI first and MCP where supported. Directory listings can create:

- early discovery from high-intent MCP users
- backlinks for AI/developer search visibility
- trust signals from installability and security metadata
- a channel for validating whether users understand the product from an agent-tool listing

But directory submission should happen after the create-app quickstart, MCP setup page, repo, server manifest, docs, and demo are ready. Submitting too early risks rejection or a weak first impression.

## Submission Readiness Gate
Do not submit until these exist:

- public landing page
- `/docs/quickstart`
- `/docs/create-app`
- `/docs/cli`
- `/docs/mcp-setup`
- `/docs/modules`
- `/docs/security`
- `/pricing` or "free during beta" pricing page
- CLI install command
- public create command
- public MCP server endpoint or installable local MCP package
- local stdio MCP package, if the target directory expects local install examples
- Dockerized MCP image only if it is already tested and documented
- GitHub repo or public docs repo
- server manifest / registry metadata
- tool list with stable names
- auth and permission model
- example Claude/Cursor MCP config plus CLI/API fallback instructions for other agents
- 60-90 second demo video
- one full agent transcript
- sample generated app or booking preview
- security policy and support contact

## Minimum MCP Tool Surface For Listing
The directory listing should not be published for an empty or vague server. Minimum viable tools:

- `list_templates`
- `inspect_template`
- `list_modules`
- `inspect_module`
- `compose_app`
- `generate_project`
- `run_checks`
- `deploy_preview` or `create_preview_plan`
- `get_deployment_status`

If managed deploy is not ready, use `create_preview_plan` instead of pretending deploy is fully automated.

## Primary Directories
| Priority | Directory | Why It Matters | Submission Notes |
|----------|-----------|----------------|------------------|
| 1 | Official MCP Registry | Canonical discovery surface for MCP servers | Publish once manifest, namespace ownership, and server metadata are clean |
| 2 | Glama MCP Directory | Large MCP discovery/indexing surface; scans/ranks servers | Strong fit if we emphasize security, compatibility, and ease of use |
| 3 | PulseMCP | MCP-focused directory and newsletter/community surface | Submit server/client and consider pitching a technical post |
| 4 | MCP.so | Community MCP marketplace with submit flow | Useful early listing and backlink; include clear connection info |

## Sources Checked
- Official MCP Registry: https://github.com/modelcontextprotocol/registry
- Glama MCP Directory: https://glama.ai/mcp
- PulseMCP: https://www.pulsemcp.com/
- MCP.so: https://mcp.so/

## Positioning Variant For MCP Directories
Tagline:

> Verified app modules for AI coding agents.

Short description:

> Create and manage Cloudflare-native app modules with a CLI-first workflow, plus MCP-compatible agent tools.

Long description:

> microservices.sh is an agent-native application infrastructure platform. Developers start with `npm create microservices-app@latest` or `pnpm create microservices-app`, then use a project CLI and MCP-compatible tools to inspect verified Cloudflare-native modules such as Auth, Customer, Booking, Payment, Email, Admin, and Audit Log. Agents can inspect module contracts, compose a production app foundation, customize behavior through config and typed hooks, run checks, and deploy previews to managed Cloudflare. The goal is to help developers build real business systems faster without trusting arbitrary generated infrastructure.

Tags:

- MCP
- AI agents
- developer tools
- Cloudflare Workers
- app generation
- modules
- SaaS starter
- booking system
- infrastructure

## Security Positioning
MCP users are increasingly sensitive to trust. The listing should include:

- least-privilege tool scopes
- no hidden destructive actions
- clear distinction between read-only and mutating tools
- confirmation requirement for production deploys
- audit log support
- source-visible generated code
- explicit secret handling rules
- security contact

Avoid listing broad tools like `run_shell` or `execute_code` in the public MCP server. That would damage trust and make directory approval harder.

## Submission Sequence
### Phase 1: Pre-Directory Asset Build
Build:

- CLI/create quickstart docs
- public create command
- MCP setup docs
- server manifest
- example MCP config for Claude/Cursor plus CLI/API fallback instructions for other agents
- CLI setup docs
- local stdio MCP package or clear hosted MCP endpoint
- Dockerized MCP docs only if the Docker image is already maintained
- demo video
- generated app sample
- security page

### Phase 2: Submit To MCP-Only Surfaces
Submit in this order:

1. Official MCP Registry
2. Glama
3. PulseMCP
4. MCP.so

### Phase 3: Use Listings For Validation
Measure:

- listing approval rate
- listing views/clicks where available
- create command runs
- local app starts
- MCP setup page visits
- MCP token/API key creations
- first successful MCP connection
- `list_templates` calls
- `compose_app` calls
- demo bookings from directory traffic

### Phase 4: Broader Directory Layer
After MCP listings are live, submit to:

- Product Hunt
- DevHunt
- BetaList
- Futurepedia / AI tool directories
- SaaSHub / AlternativeTo
- GitHub topic lists and awesome lists

Do this only after the product has enough screenshots, demo, pricing, privacy, terms, and a working onboarding path.

## Directory Launch Metrics
Directory submissions are validation if they drive usage, not just backlinks.

Good signs:

- 20+ quickstart or MCP setup page visits per week from directories
- 10+ create command runs from directory traffic
- 10+ successful MCP connections
- 5+ generated app attempts
- 3+ discovery calls from directory traffic
- at least one qualified agency lead

Weak signs:

- listing approved but no setup attempts
- visitors bounce from MCP setup page
- users install but do not call any tools
- users only ask for free source code

## Risks
- Directory users expect a normal MCP connector, not an application-generation platform.
- The listing may confuse users if managed deploy is not ready.
- Security-sensitive users may reject broad mutation/deployment tools.
- Submitting too early can create dead listings with stale positioning.

## Decision
Publish to MCP directories as part of the MVP validation plan, but only after the create-app quickstart and MCP setup flow are credible.

This should be treated as a validation/discovery channel, not the first activation path.

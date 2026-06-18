# Market Product Direction And MCP Distribution Review

Generated: 2026-06-17
Updated: 2026-06-18

## Verdict
microservices.sh should not lead as a generic dev tool, SaaS starter, boilerplate, or MCP server.

The most valuable product is production confidence for agent-built business apps:

- verified, source-visible modules
- safe app composition
- agent-readable contracts
- deploy and provisioning guardrails
- upgrade plans and lockfile diffs
- managed Cloudflare previews
- scoped auth, auditability, and cost controls

The CLI, create package, hosted MCP endpoint, local MCP package, and Docker image are distribution surfaces. They are not the main value.

## Project Diagnosis
The repository already contains the strongest differentiator:

- module contracts and package standards
- template specs and source-visible SvelteKit templates
- lockfile-based upgrade planning
- MCP and CLI parity over shared SDK logic
- managed Cloudflare deployment planning
- auth/workspace scoping and audit direction
- honeycomb module-connection standard using RPC, events, and hooks

The positioning is still partly stale:

- `packages/create-microservices-app/package.json` still describes the package as a "Cloudflare-native SaaS app" scaffold.
- `packages/create-microservices-app/README.md` still leads with SaaS app language.
- `templates/README.md` is behind the actual template set and does not reflect `client-portal-sveltekit`, `erp-shell-sveltekit`, `saas-starter-sveltekit`, or `company-landing-astro`.
- The product has multiple good templates, but the public story should still lead with one buyer pain and one concrete outcome.

## Market Read
Stack Overflow 2025 supports the macro opportunity but also the trust problem: developers broadly use AI tools, yet distrust remains high and deployment or monitoring work is still treated cautiously. That is the opening.

DORA 2025 reinforces that AI is an amplifier. Better outcomes come from the surrounding system, not from adding another AI tool. This favors module contracts, reviewable changes, checks, rollout gates, and production workflows.

Lovable, Bolt, and Replit own broad "prompt to app" mindshare and price around usage, credits, hosting, and collaboration. Competing directly there would make microservices.sh look like a smaller app builder.

ShipFast and MakerKit prove buyers pay to avoid repetitive setup, especially auth, billing, teams, admin, and AI-agent-friendly codebases. They also create a price anchor and substitute. microservices.sh should not be only a static boilerplate.

Medusa shows a strong adjacent pattern: modules, CLI, cloud, MCP, and agent tooling around a production domain. Its wedge is commerce. microservices.sh should avoid commerce-first competition and instead target broader service-business, client-portal, and operations apps.

Composio shows that the connector market is crowded. Integrations should support microservices.sh modules, not become the whole product.

Cloudflare Workers for Platforms is a good technical fit, but raw Cloudflare infrastructure is inexpensive. The business cannot be priced as hosting markup. Price the safety layer, managed workflow, modules, upgrades, and support.

## What Users Actually Need
The user need is not "I need an MCP server" or "I need another CLI."

The real needs are:

- I need my agent to start from a known-good production foundation.
- I need auth, RBAC, payments, email, webhooks, migrations, idempotency, jobs, audit logs, and admin flows that are already designed to work together.
- I need to customize source code without losing the upgrade path.
- I need to understand what a module will change before I approve it.
- I need safe previews and deploy steps without becoming a Cloudflare expert.
- I need cost, permissions, and production side effects to be bounded.
- I need a project my client, team, or future developer can inspect and own.

## Best ICP
The best first buyer is likely not a generic developer.

Prioritize:

1. AI-heavy agencies and fractional CTOs shipping repeated client portals, booking systems, dashboards, and operations apps.
2. Internal ops builders who need real workflow apps faster than normal custom development.
3. Founders who already use Cursor, Claude, Codex, or similar tools and fear production mistakes.

The first wedge should be "agent-assisted production business apps," not "developer tools."

Recommended first offer:

"Bring your agent. Ship a production client portal or service-business operating app on Cloudflare with verified modules, source ownership, and managed previews."

## Template Direction
Booking is useful as a demo because it is concrete and exposes real production concerns: availability, customers, notifications, admin review, and conflicts.

For willingness to pay, client portal and ERP shell may be stronger than booking alone because agencies and internal teams repeatedly need:

- customer records
- documents and files
- invoices and payments
- tasks and approvals
- team permissions
- audit history
- notifications
- reports

Test these three wedges before locking the public category:

1. Client portal for agencies and consultants.
2. Service-business operating system with booking, customers, invoices, and notifications.
3. Internal ops/ERP shell for small teams.

## Positioning
Use one of these as the public category:

- production guardrails for AI-built business apps
- agent-ready app foundation
- agent-native application infrastructure

Avoid leading with:

- Cloudflare SaaS starter
- MCP server
- boilerplate
- no-code app builder
- connector marketplace

Cloudflare should appear as proof of deployability and cost control, not as the headline.

## Pricing Implication
The current $49, $99, and $299 beta pricing hypothesis is plausible, but should be validated as labor saved and risk reduced:

- Builder: one managed app or project for serious solo builders.
- Pro: multiple apps, preview workflows, better support, and upgrade guidance.
- Agency: multiple client projects, team/workspace controls, auditability, and support.

Do not justify price with Cloudflare hosting cost. Raw platform costs are too low. Justify price with modules, agent safety, managed workflow, and upgrade confidence.

## MCP And Docker Decision
Yes, create Docker packaging for MCP, but do not lead with it and do not build it as a separate implementation.

Dockerized MCP should wrap the same local stdio MCP package, which should call the same hosted API or SDK methods used by the CLI. It is valuable for:

- enterprise and security-conscious users who dislike arbitrary `npx` execution
- devcontainer and team setup
- reproducible local agent environments
- MCP directory listings that benefit from OCI package metadata
- avoiding local Node dependency conflicts

It is not the first activation path. Users should first be able to run:

```sh
pnpm create microservices-app@latest my-app --template client-portal-sveltekit
```

Then they can add MCP once value is visible.

Implementation update, 2026-06-17: `@microservices-sh/mcp` now lives in a standalone sibling repo at `/home/ubuntu/Project/microservices-sh/mcp`. It is a local stdio server with a vendored SDK/module-contract snapshot and optional remote control-plane calls. Docker/OCI should wrap this package entrypoint.

## MCP Directory Publishing
Publish to MCP directories, but only after the install and security story is credible.

Recommended order:

1. Remote MCP listing: expose a public Streamable HTTP endpoint, for example `https://api.microservices.sh/mcp`, with API key auth for mutating tools.
2. Local stdio package: publish `@microservices-sh/mcp` for clients that prefer local servers. The standalone `mcp` repo now builds and pack-smokes independently.
3. Docker/OCI package: publish `ghcr.io/microservices-sh/mcp:<version>` wrapping the local stdio server.
4. Official MCP Registry submission: include both `remotes` and `packages` in `server.json` when both are ready.
5. Secondary directories: submit to Glama, PulseMCP, and MCP.so after the official registry path and docs are stable.

For the official MCP Registry:

- The registry hosts metadata, not package artifacts.
- Publish the npm package and OCI image first.
- For npm, set `mcpName` in `package.json` to match the server name.
- For Docker/OCI, add the label `io.modelcontextprotocol.server.name`.
- Use DNS authentication for the `microservices.sh` namespace, likely reverse-DNS `sh.microservices/...`, or use GitHub namespace authentication if shipping under `io.github.microservices-sh/...`.
- Keep mutating tools scoped, authenticated, and confirmation-gated.

Minimum public MCP tool surface:

- list templates
- inspect template
- list modules
- inspect module
- create or compose app plan
- run checks
- create preview plan or deploy preview
- get deployment status

Avoid public generic tools like `run_shell`, `execute_code`, or unrestricted file writes.

## Current Distribution State
- Standalone repo: `https://github.com/microservices-sh/mcp`
- npm package: `@microservices-sh/mcp@0.1.1`
- Hosted endpoint: `https://api.microservices.sh/mcp`
- Official MCP Registry: metadata validates with `mcp-publisher`; publish is blocked until `microservices.sh` namespace authentication is configured.
- Open directory PRs: Awesome MCP Servers, MCPFind, MCPSvr, and Docker MCP Registry.

## Next Product Actions
1. Update stale SaaS-first language in `packages/create-microservices-app`.
2. Refresh `templates/README.md` so it matches the real template inventory.
3. Pick one public wedge for the next landing page and onboarding path.
4. Run 10 to 15 agency and fractional CTO interviews around client portal, service-business OS, and ERP shell wording.
5. Complete `microservices.sh` namespace authentication and publish the validated `server.json` to the official MCP Registry.
6. Track directory PR review, then add account-driven listings for PulseMCP, MCP.so, Glama, and Smithery under the correct namespace.
7. Add Docker/OCI packaging once API-key auth and the remote mutating-tool safety story are stable.
8. Keep MCP as discovery and agent parity; do not let it replace the create-app activation path.

## Sources
- Stack Overflow 2025 AI survey: https://survey.stackoverflow.co/2025/ai
- DORA 2025 report: https://dora.dev/research/2025/dora-report/
- Cloudflare Workers for Platforms: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/
- Workers for Platforms pricing: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/
- MCP introduction: https://modelcontextprotocol.io/docs/getting-started/intro
- Official MCP Registry: https://github.com/modelcontextprotocol/registry
- MCP Registry publishing guide: https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx
- MCP package types: https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/package-types.mdx
- MCP remote servers: https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/remote-servers.mdx
- MCP security best practices: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- Lovable pricing: https://lovable.dev/pricing
- Replit pricing: https://replit.com/pricing
- Bolt pricing: https://bolt.new/pricing
- ShipFast: https://shipfa.st/
- MakerKit pricing: https://makerkit.dev/pricing
- Medusa: https://medusajs.com/
- Composio pricing: https://composio.dev/pricing

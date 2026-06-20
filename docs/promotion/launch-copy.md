# Launch Copy

Reusable copy for MCP directory follow-ups, social posts, and founder outreach.

## One-Line Positioning

Production foundations for AI-built Cloudflare apps: verified modules, local checks, agent-readable contracts, and approval-gated deploys.

## Directory Follow-Up Comment

microservices.sh is now published in the official MCP Registry as `sh.microservices/mcp`:

```text
https://registry.modelcontextprotocol.io/v0.1/servers?search=sh.microservices/mcp
```

npm package:

```text
https://www.npmjs.com/package/@microservices-sh/mcp
```

Hosted Streamable HTTP endpoint:

```text
https://api.microservices.sh/mcp
```

The MCP server exposes module/template inspection, app composition, local checks, and confirmation-gated preview-deploy planning tools for Cloudflare-native business apps.

## X Launch Post

We published microservices.sh to the official MCP Registry.

`sh.microservices/mcp` gives coding agents a safer way to build Cloudflare-native business apps:

- inspect verified modules
- compose app plans
- read local docs
- run checks
- create approval-gated deploy plans

Agents are good at UI and glue code. The risky part is the production layer: auth, billing, tenant boundaries, migrations, audit logs, and deploys.

That is the part microservices.sh packages.

CLI:

```bash
npm create microservices-app@latest studio-booking -- --template booking-sveltekit
```

MCP:

```bash
npx -y @microservices-sh/mcp
```

## LinkedIn Launch Post

We just published microservices.sh to the official MCP Registry as `sh.microservices/mcp`.

The product idea is simple: coding agents should not have to invent the production layer every time they build an app.

They are already good at screens, route changes, and glue code. The fragile part is the production 30 percent: auth, billing, webhooks, tenant boundaries, migrations, audit logs, and deployment safety.

microservices.sh packages those pieces as Cloudflare-native modules with local docs, pinned versions, deterministic checks, and approval-gated deploy plans.

You can use it two ways:

- CLI: generate and inspect a working SvelteKit/Workers app locally.
- MCP: let an agent inspect modules, compose plans, run checks, and prepare approval-gated deploy plans from an MCP client.

First install:

```bash
npm create microservices-app@latest studio-booking -- --template booking-sveltekit
```

MCP server:

```bash
npx -y @microservices-sh/mcp
```

The goal is not to hide code behind a platform. The generated app is source-visible, owned by you, and built around contracts that agents can read before they edit.

## Founder Outreach

Subject: Safer AI-built Cloudflare apps

Hi {{name}},

I am building microservices.sh for technical founders and agencies using coding agents to ship production apps.

The wedge: agents can build UI quickly, but they still tend to improvise auth, billing, tenant boundaries, migrations, audit logs, and deploy workflows. microservices.sh packages those pieces as inspectable Cloudflare-native modules with local checks and approval-gated deploy plans.

The CLI generates a working app locally. The MCP server lets Claude, Codex, Cursor, or another client inspect modules and prepare safe changes.

If you have a booking app, customer portal, internal tool, or SaaS MVP idea, I can generate the first Cloudflare-native foundation and show exactly where the agent can customize safely.

## Show HN Draft

Show HN: microservices.sh - production foundations for AI-built Cloudflare apps

I built microservices.sh for developers using coding agents to create real business apps on Cloudflare.

The premise is that agents are already useful for UI, routes, and glue code, but the production layer is still risky: auth, billing, webhooks, tenant boundaries, migrations, audit logs, and deployment checks.

microservices.sh packages those pieces as source-visible Cloudflare-native modules. The generated app includes local docs and pinned module versions so an agent can inspect contracts before editing.

Current surfaces:

- `npm create microservices-app@latest`
- generated project CLI for checks, docs, upgrades, and deploy plans
- official MCP Registry server: `sh.microservices/mcp`
- hosted MCP endpoint: `https://api.microservices.sh/mcp`

This is intentionally not a no-code builder. The generated code is inspectable and owned by the user.

I would especially like feedback from people using agents to build SaaS MVPs, booking flows, customer portals, or internal tools.

# CLI And MCP Demo Script

Use this as the source script for a 90-second screen recording. The goal is to show the product as production foundations for AI-built Cloudflare apps, not as another starter kit or only an MCP server.

## Demo Promise

Agents can build screens quickly, but production apps fail at auth, billing, tenant boundaries, migrations, and deploy safety. microservices.sh gives agents verified Cloudflare-native modules, local checks, and approval-gated deploy plans.

## Recording Setup

- Terminal with a large font and clean prompt.
- Browser ready for the generated app.
- Agent/MCP client settings ready to show the MCP config.
- Keep secrets out of the recording.
- Use the template `booking-sveltekit` and app name `studio-booking`.

## Timeline

| Time | Visual | Voiceover |
|------|--------|-----------|
| 0-10s | Show repo or landing headline | "AI agents are fast at the first 70 percent of an app. The risky part is the production 30 percent: auth, billing, tenant boundaries, migrations, audit logs, and deploys." |
| 10-25s | Run create command | "microservices.sh starts from Cloudflare-native app foundations that agents can inspect and change." |
| 25-40s | Open generated app in browser | "This is a real app, not a mock: SvelteKit, Workers, D1 migrations, booking flow, admin screens, and source you own." |
| 40-55s | Show `docs/modules/booking.md` and `microservices.lock.json` | "The agent gets local module contracts and pinned versions, so it can read the rules before editing." |
| 55-68s | Run CLI checks | "The CLI gives deterministic checks and plans before anything risky happens." |
| 68-80s | Show MCP config and official registry link | "The same surface is available through MCP, published as `sh.microservices/mcp` in the official registry." |
| 80-90s | Show deploy plan command result | "Deploys stay approval-gated. The agent can plan the preview, but production actions still require confirmation." |

## Commands To Show

```bash
npm create microservices-app@latest studio-booking -- --template booking-sveltekit
cd studio-booking
pnpm install
pnpm microservices local setup
pnpm dev
```

In a second terminal:

```bash
pnpm microservices modules list --json
pnpm microservices docs booking
pnpm microservices check --json
pnpm microservices deploy run --plan
```

For MCP:

```bash
npx -y @microservices-sh/mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "microservices": {
      "command": "npx",
      "args": ["-y", "@microservices-sh/mcp"],
      "env": {
        "MICROSERVICES_API_URL": "https://api.microservices.sh"
      }
    }
  }
}
```

## Caption

AI agents can generate app code fast. The hard part is making the app safe to operate.

microservices.sh gives coding agents verified Cloudflare-native modules, local checks, and approval-gated deploy plans. Start with a working app, inspect the module contracts, run deterministic checks, then let your agent customize inside clear boundaries.

CLI:

```bash
npm create microservices-app@latest studio-booking -- --template booking-sveltekit
```

MCP:

```bash
npx -y @microservices-sh/mcp
```

Official MCP Registry: `sh.microservices/mcp`

## Short Version

Agents should not invent auth, billing, migrations, tenant boundaries, and deploy checks from scratch. microservices.sh packages those production foundations into inspectable Cloudflare-native modules, a local CLI, and an official MCP server.

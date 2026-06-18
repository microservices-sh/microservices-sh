# Demo Recording Runbook

This runbook turns the 90-second script into a repeatable recording session.

## Objective

Show that microservices.sh is not just an MCP server. It is a CLI plus MCP workflow for generating Cloudflare-native app foundations that agents can inspect, check, and deploy behind approval gates.

## Recording Profile

- Format: 16:9, 1080p or higher.
- Length: 75-100 seconds.
- Terminal font: 16-18px.
- Browser zoom: 100-110%.
- Keep tokens, API keys, `.env`, and local config out of frame.
- Use `studio-booking` as the demo app name.

## Prepare The Demo App

For a public-recording path that matches the README:

```bash
bash docs/promotion/demo-terminal-runner.sh clean
bash docs/promotion/demo-terminal-runner.sh prep
```

For a local package path while testing unpublished changes:

```bash
MODE=local bash docs/promotion/demo-terminal-runner.sh clean
MODE=local bash docs/promotion/demo-terminal-runner.sh prep
```

The runner uses `/tmp/microservices-sh-demo/studio-booking` by default.

## Recording Layout

Use three prepared tabs:

1. **CLI generation**
   - show `npm create microservices-app@latest studio-booking -- --template booking-sveltekit`
   - show generated files
2. **Generated app**
   - run `bash docs/promotion/demo-terminal-runner.sh serve`
   - show the browser app
3. **Agent/MCP workflow**
   - run `bash docs/promotion/demo-terminal-runner.sh checks`
   - run `bash docs/promotion/demo-terminal-runner.sh mcp-config`
   - show the official registry link

## Recording Beats

| Beat | Target Time | Action |
|------|-------------|--------|
| Hook | 0-10s | Say agents are fast at UI but risky at production foundations. |
| Generate | 10-25s | Show create command and generated app directory. |
| Inspect | 25-45s | Show `docs/modules/booking.md` and `microservices.lock.json`. |
| Check | 45-65s | Run module list/check commands. |
| MCP | 65-82s | Show MCP config, npm package, and official registry. |
| Approval gate | 82-95s | Show deploy plan command, emphasize confirmation gates. |

## Commands During Recording

```bash
bash docs/promotion/demo-terminal-runner.sh cues
bash docs/promotion/demo-terminal-runner.sh checks
bash docs/promotion/demo-terminal-runner.sh mcp-config
```

## Links To Show

- Official MCP Registry: https://registry.modelcontextprotocol.io/v0.1/servers?search=sh.microservices/mcp
- npm MCP package: https://www.npmjs.com/package/@microservices-sh/mcp
- Smithery: https://smithery.ai/servers/microservices-sh/mcp
- GitHub MCP repo: https://github.com/microservices-sh/mcp

## Editing Notes

- Cut installs aggressively. Show the command, then jump to the generated app.
- Keep every shot tied to the promise: agent-readable contracts, deterministic checks, approval-gated deploys.
- End with the install command and registry name on screen.

Final card:

```text
npm create microservices-app@latest studio-booking -- --template booking-sveltekit
npx -y @microservices-sh/mcp
Official MCP Registry: sh.microservices/mcp
```

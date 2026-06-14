# CLI, SDK, And MCP Packaging Decision

Generated: 2026-06-13
Updated: 2026-06-13

## Decision Summary
microservices.sh should support multiple agent/developer access paths, but not all at the same MVP priority.

The first activation path should be a familiar create-app flow. MCP stays important, but it should not be the first setup dependency.

| Surface | MVP Priority | Decision |
|---------|--------------|----------|
| Create package | P0 | First activation through `npm create microservices-app@latest` / `pnpm create microservices-app` |
| Project CLI | P0 | Agent/developer control surface inside generated apps |
| Internal TypeScript SDK | P0 | Shared implementation for create package, CLI, MCP, tests, and future API |
| Remote MCP server | P0.5 | First-class agent interface after CLI/create is credible |
| Local stdio MCP package | P1 | Compatibility for clients that prefer or require local subprocess launch |
| Dockerized MCP | P1.5 | Reproducible setup for enterprise/devcontainer workflows after demand is proven |
| Public SDK | P2 | Defer until module and API contracts stabilize |

## Why This Matters
Different developer agents and MCP clients support different connection models. The product should not depend on one client-specific setup path.

MCP's current standard transports include:

- `stdio`: the client launches a local MCP server subprocess.
- Streamable HTTP: the server exposes one HTTP endpoint such as `/mcp`.

But the fastest way to demonstrate value is:

1. create an app locally
2. inspect generated source
3. run checks
4. add or plan a module
5. deploy a managed preview after login

This sequence gives developers value before they configure MCP, Cloudflare, or billing.

## Recommended Access Architecture
Use one shared core API/client layer.

```text
create-microservices-app / project CLI
        |
        v
packages/sdk-internal
        |
        v
module registry + generator + checks + control-plane API
        |
        v
generated app / managed preview deploy

Hosted MCP / local stdio MCP / Dockerized MCP
        |
        v
packages/sdk-internal
        |
        v
same registry, generator, checks, and control-plane API
```

Do not implement separate business logic in the create package, project CLI, local MCP, Dockerized MCP, and hosted MCP server. They should call the same internal SDK/API methods so behavior stays consistent.

## Create Package Recommendation
Build the create package first.

Recommended commands:

```bash
npm create microservices-app@latest booking-demo
pnpm create microservices-app booking-demo
```

Purpose:

- show value before MCP configuration
- generate a local app without login
- create a familiar onboarding path for developers and agents
- write `README.agent.md`, `docs/llms.txt`, and `microservices.lock.json`
- give demos and validation calls a repeatable first command

Rules:

- local generation must work without a Cloudflare account
- login is only required for managed preview deploys or account features
- every machine-readable result should support `--json`
- generated apps must include the project CLI command

## Project CLI Recommendation
Build the project CLI in the MVP.

Purpose:

- primary project management surface after app creation
- universal fallback for agents without reliable MCP support
- local generation, inspection, and checks
- authentication and token management
- debug path when hosted MCP setup fails
- CI-friendly command surface
- predictable demos and onboarding

Recommended command:

```bash
microservices
```

MVP commands:

```bash
microservices templates list --json
microservices templates inspect booking-business --json
microservices modules list --json
microservices modules inspect booking --json
microservices docs booking
microservices add payment-stripe --plan --json
microservices secrets status --json
microservices check --json
microservices dev
microservices deploy preview --json
microservices deploy status --json
microservices logs --json
```

Rules:

- CLI wraps the same API/tool contracts as MCP.
- Every command supports `--json` for agents and CI.
- Human output can be friendly, but machine output must be stable.
- Mutating commands must show side effects and require explicit confirmation for production.
- Never make the CLI a second dashboard.

## Internal SDK Recommendation
Build an internal TypeScript SDK early.

Purpose:

- shared implementation for create package, CLI, MCP Worker, tests, and future public SDK
- typed client for module/template/deploy operations
- one source of truth for request/response contracts
- easier agent-generated examples

Initial package:

```text
packages/sdk-internal
```

It should expose:

- `createApp(input)`
- `listTemplates()`
- `inspectTemplate(id)`
- `listModules()`
- `inspectModule(id)`
- `getModuleDoc(id)`
- `planAddModule(input)`
- `addModule(input)`
- `getSecretsStatus(input)`
- `composeApp(input)`
- `validateConfig(input)`
- `generateProject(input)`
- `runChecks(projectId)`
- `deployPreview(projectId)`
- `getDeploymentStatus(projectId)`
- `getLogs(projectId)`

Do not publish a public SDK until:

- the MVP module contract has survived pilot users
- tool names and response schemas are stable
- auth and permission model is stable
- versioning rules are clear

When public SDK is ready, start with TypeScript only. Avoid multi-language SDK maintenance before there is demand.

## Remote MCP Recommendation
Remote MCP is a first-class agent path, but not the first activation dependency.

Endpoint:

```text
https://api.microservices.sh/mcp
```

Responsibilities:

- expose agent tools
- validate tokens/scopes
- call internal SDK/control plane
- return structured JSON responses
- provide agent-readable errors
- log tool calls for audit/debugging

Rules:

- Use Streamable HTTP for the hosted endpoint.
- Keep tool behavior aligned with create package and CLI behavior.
- Require auth for mutating tools.
- Keep destructive production actions behind explicit confirmation.
- Avoid broad tools such as `run_shell` or arbitrary `execute_code`.
- Include request IDs in tool responses.

## Local stdio MCP Recommendation
Add a local stdio MCP package after the create/CLI path and hosted MCP path work.

Purpose:

- support MCP clients that launch local subprocesses
- simplify desktop setup
- provide a stable install command for directories and docs
- allow local `.env` or token config when users do not want a remote connector configured directly

Package:

```text
@microservices-sh/mcp
```

Example client config:

```json
{
  "mcpServers": {
    "microservices": {
      "command": "npx",
      "args": ["-y", "@microservices-sh/mcp"],
      "env": {
        "MICROSERVICES_API_KEY": "ms_live_..."
      }
    }
  }
}
```

Implementation rule:

The local stdio MCP package should be a thin proxy to the hosted API. It should not contain independent platform logic.

## Dockerized MCP Recommendation
Dockerized MCP is useful, but not required for the first MVP loop.

Add it when at least one of these is true:

- MCP directory submissions benefit from a reproducible Docker install.
- agencies ask for devcontainer or team-standardized setup.
- enterprise/security users do not want `npx` package execution.
- local dependency conflicts become a support burden.
- we want a stable integration test harness for MCP clients.

Image:

```text
ghcr.io/microservices-sh/mcp:latest
```

Rules:

- Keep the image small.
- Run as non-root.
- Do not bake secrets into the image.
- Read secrets from environment variables or mounted secret files.
- Write protocol messages only to stdout.
- Write logs to stderr.
- Pin runtime versions.
- Add SBOM/signing later if enterprise demand appears.

For the MVP, Dockerized MCP should be a packaging layer over the same local stdio MCP server, not a separate server implementation.

## Public SDK Recommendation
Do not lead with a public SDK.

A public SDK sounds developer-friendly, but it creates maintenance load before we know which contracts are stable.

Defer public SDK until:

- 10+ users have completed the generated app flow
- at least 3 users ask to integrate microservices.sh into their own toolchain
- module contract and deploy workflow are stable
- versioning and deprecation policy exist

Likely first public SDK:

```text
@microservices-sh/sdk
```

Do not support public custom module publishing through the SDK in the MVP.

## MVP Build Order
1. Define stable module/template/project schemas.
2. Build `packages/sdk-internal`.
3. Build `create-microservices-app` on top of the SDK.
4. Build the project `microservices` CLI on top of the SDK.
5. Add `--json` output to all create/CLI commands.
6. Add hosted MCP Worker on top of the same SDK.
7. Add local stdio MCP package as a thin hosted API proxy.
8. Add Dockerized MCP package only after create, CLI, and hosted MCP are working.
9. Defer public SDK until after paid pilots.

## Documentation Needed
Before public launch, create:

- `/docs/quickstart`
- `/docs/create-app`
- `/docs/cli`
- `/docs/mcp-setup`
- `/docs/auth-tokens`
- `/docs/agent-workflows`
- `/docs/security`
- `/docs/docker-mcp` only after Docker image exists

## Validation Questions
Ask pilot users:

1. Could you run the create command and start local dev without support?
2. Where did setup fail?
3. Did your agent understand the generated `README.agent.md` and lock file?
4. Did you trust `npx`, or would Docker feel safer?
5. Did your agent prefer CLI commands or MCP tools?
6. Would you use the CLI in CI or client delivery workflows?
7. Would a public SDK matter before the product has more modules?

## Success Criteria
Create-app success:

- 80 percent of pilot users can run `pnpm create microservices-app` and start local dev in under 10 minutes.
- generated apps include agent docs and a lock file.
- agents can continue from the generated project without dashboard instructions.

CLI success:

- 80 percent of pilot users can run `microservices modules list` and `microservices check` in the generated project.
- agent can use `--json` CLI output without human parsing.
- CLI can plan module additions and explain permissions/secrets.

MCP success:

- one remote MCP setup path works from docs only.
- one local stdio config works from docs only.
- first `list_templates` call succeeds without support intervention.
- MCP tool results match the create/CLI SDK behavior.

Dockerized MCP success:

- Docker image starts in under 5 seconds on a typical developer machine.
- no protocol logs leak to stdout.
- one agency user says Docker solves a real setup/security concern.

SDK success:

- internal SDK powers create, CLI, and MCP without duplicated tool logic.
- public SDK remains deferred until real integration demand appears.

## Sources
- MCP transports: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
- MCP debugging and local stdio setup guidance: https://modelcontextprotocol.io/docs/tools/debugging

## Final Recommendation
Yes, consider CLI, SDK, and Dockerized MCP, but sequence them carefully:

- Build **create package** in the MVP.
- Build **project CLI** in the MVP.
- Build **internal TypeScript SDK** in the MVP.
- Build **hosted remote MCP** as a first-class parity interface after create/CLI.
- Add **local stdio MCP package** soon after hosted MCP.
- Add **Dockerized MCP** for distribution and trust after the first create/CLI/MCP flows work.
- Defer **public SDK** until pilot usage proves stable contracts and integration demand.

See `20-cli-first-create-app-strategy.md` for the updated activation strategy.

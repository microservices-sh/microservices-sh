# MCP Directory Submission Status

Last updated: 2026-06-18.

## Live

| Directory | Status | URL |
|-----------|--------|-----|
| Official MCP Registry | Published and active | https://registry.modelcontextprotocol.io/v0.1/servers?search=sh.microservices/mcp |
| npm | Published as `@microservices-sh/mcp` | https://www.npmjs.com/package/@microservices-sh/mcp |
| Smithery | Published as `microservices-sh/mcp`; release accepted, scan/indexing may lag | https://smithery.ai/servers/microservices-sh/mcp |

## Open PRs

| Directory | Status | URL |
|-----------|--------|-----|
| Awesome MCP Servers | PR open, checks passing | https://github.com/punkpeye/awesome-mcp-servers/pull/8249 |
| MCPFind | PR open; Vercel authorization failure appears unrelated to the YAML entry | https://github.com/MCPFind/mcp-find/pull/77 |
| MCPSvr | PR open | https://github.com/nanbingxyz/mcpsvr/pull/33 |
| Docker MCP Registry | PR open; local Docker registry validation passed | https://github.com/docker/mcp-registry/pull/3961 |

## UI-Only Or Blocked

| Directory | Status | Next action |
|-----------|--------|-------------|
| PulseMCP | Submit page blocked this environment with Cloudflare. PulseMCP may also ingest the official registry. | Open https://www.pulsemcp.com/submit in a browser and submit the official registry URL. |
| MCP.so | Submit page blocked this environment with Cloudflare managed challenge. | Open https://mcp.so/submit in a browser and submit official registry, npm package, repo, and hosted endpoint. |
| Glama | Public search does not yet show microservices.sh. Add Server appears to be an authenticated UI action. | Open https://glama.ai/mcp/servers, click Add Server, and submit the GitHub repo or registry URL. |

## Submission Fields

Use these values consistently:

```text
Name: microservices.sh
Registry name: sh.microservices/mcp
Smithery name: microservices-sh/mcp
npm package: @microservices-sh/mcp
GitHub repo: https://github.com/microservices-sh/mcp
Official MCP Registry: https://registry.modelcontextprotocol.io/v0.1/servers?search=sh.microservices/mcp
Hosted endpoint: https://api.microservices.sh/mcp
Transport: Streamable HTTP for hosted endpoint; stdio for npm package
Category: Developer Tools, Cloud Platforms, Agent Orchestration
Description: Build and deploy verified Cloudflare-native business apps with agent guardrails.
Long description: Inspect verified Cloudflare-native modules and templates, compose app plans, run checks, and trigger confirmation-gated preview deploys.
```

## Smithery Notes

Namespace `microservices-sh` has been claimed in the current Smithery account. The server was published with:

```bash
smithery mcp publish "https://api.microservices.sh/mcp" -n microservices-sh/mcp --config-schema '{"type":"object","properties":{"apiKey":{"type":"string","description":"microservices.sh API key for remote deploy and status tools"}},"additionalProperties":false}'
```

Smithery page:

```text
https://smithery.ai/servers/microservices-sh/mcp
```

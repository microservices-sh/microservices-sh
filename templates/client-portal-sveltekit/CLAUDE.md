# Customizing this app (agent playbook)

This is a SvelteKit client-portal app on Cloudflare. Customization is split across
a few well-defined surfaces — edit the right one for each kind of change.

## Public home page copy → `src/content.json`

The customer-facing home page (`src/routes/+page.svelte`) is **data-driven**.
Edit `src/content.json` to change its hero and highlights. The contract — fields,
length limits, per-field `x-hint` — is in `content.schema.json` (JSON Schema,
draft 2020-12); the `SiteContent` type in `src/content.types.ts` is generated
from it.

Workflow:
1. Read `content.schema.json` (the contract + `x-microservices` envelope).
2. Edit `src/content.json` — the existing values are a valid example. Respect
   `maxLength` and the `panel.features` bounds (3–6).
3. Verify: `npm run validate` (fast, path-pointed errors) — it also runs
   automatically before `npm run build`. Then `npm run dev` to preview.

## Other customization surfaces (NOT in content.json)

- **Brand colors & fonts** → `src/app.css` design tokens. See `THEMING.md`.
- **Login, portal, and admin screens** → still hardcoded in their `.svelte`
  components. Not externalized yet; edit in place if needed, carefully.

## Expose modules as governed agent tools (MCP)

This app can serve its modules to an AI agent as **governed tools** — each rpc
method becomes a scoped, approval-gated, audited MCP tool (auth, identity,
customer, file-media).

- `generated/tool-manifest.ts` + `generated/mcp-server.mjs` are generated from the
  module contracts (`npm run generate:mcp`); do not hand-edit them.
- `src/lib/server/mcp-wiring.ts` is the **edit seam**: it binds each tool to its
  module use-case + deps (memory adapters by default; swap to D1/R2 for a real
  backend), supplies the audit sink, and resolves the agent's actor + scopes
  (`MCP_AGENT_ID` / `MCP_AGENT_SCOPES`).

Run the stdio server (after install): `npm run mcp`. Mutations (e.g. creating an
upload ticket) are held at an approval gate until the caller confirms; reads with
the right scope flow through; every call is written to the audit log.

## Don't

- Don't edit `src/content.types.ts` — it's generated from the schema.
- Don't add fields not in the schema (`additionalProperties: false`; `npm run
  validate` and `npm run build` will fail).
- Don't hand-edit `src/routes/+page.svelte` for copy — change `src/content.json`.

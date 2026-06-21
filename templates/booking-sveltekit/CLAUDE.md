# Customizing this app (agent playbook)

This is a SvelteKit booking app on Cloudflare. Customization is split across a
few well-defined surfaces — edit the right one for each kind of change.

## Public home page copy → `src/content.json`

The customer-facing home page (`src/routes/+page.svelte`) is **data-driven**.
Edit `src/content.json` to change its hero and highlights. The contract — fields,
length limits, per-field `x-hint` — is in `content.schema.json` (JSON Schema,
draft 2020-12); the `SiteContent` type in `src/content.types.ts` is generated
from it.

Workflow:
1. Read `content.schema.json` (the contract + `x-microservices` envelope).
2. Edit `src/content.json` — the existing values are a valid example. Respect
   `maxLength` and the exactly-3 `panel.features`.
3. Verify: `npm run validate` (fast, path-pointed errors) — it also runs
   automatically before `npm run build`. Then `npm run dev` to preview.

## Other customization surfaces (NOT in content.json)

- **Business name, currency, timezone, booking policy** → `microservices.config.json`
  (`business`, `booking`, `customer`). Consumed at setup/build time.
- **Brand colors & fonts** → `src/app.css` design tokens. See `THEMING.md` for a
  30-second rebrand.
- **Booking flow, admin, and email copy** → still hardcoded in their `.svelte`
  components and `src/lib/server/notifications.ts`. Not externalized yet; edit in
  place if needed, carefully.

## Expose modules as governed agent tools (MCP)

This app can serve its modules to an AI agent as **governed tools** — each rpc
method becomes a scoped, approval-gated, audited MCP tool.

- `generated/tool-manifest.ts` + `generated/mcp-server.mjs` are generated from the
  module contracts by the build (do not hand-edit; they're build output).
- `src/lib/server/mcp-wiring.ts` is the **edit seam**: it binds each tool to its
  module use-case + deps (memory adapters by default; swap to the D1 adapters for
  a real DB), supplies the audit sink, and resolves the agent's actor + scopes
  (from `MCP_AGENT_ID` / `MCP_AGENT_SCOPES`).

Run the stdio server (after a build/generate, with deps installed):
`npm run mcp`. Mutations are held at an approval gate until the caller confirms;
reads with the right scope flow through; every call is written to the audit log.

## Don't

- Don't edit `src/content.types.ts` — it's generated from the schema.
- Don't add fields not in the schema (`additionalProperties: false`; `npm run
  validate` and `npm run build` will fail).
- Don't hand-edit `src/routes/+page.svelte` for copy — change `src/content.json`.

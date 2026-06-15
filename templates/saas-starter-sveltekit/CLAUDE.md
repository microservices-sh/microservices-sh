# Customizing this app (agent playbook)

This is a SvelteKit multi-tenant B2B SaaS app on Cloudflare. Customization is
split across a few well-defined surfaces — edit the right one for each change.

## Public home page copy → `src/content.json`

The customer-facing marketing home page (`src/routes/+page.svelte`) is
**data-driven**. Edit `src/content.json` to change its hero and highlights. The
contract — fields, length limits, per-field `x-hint` — is in `content.schema.json`
(JSON Schema, draft 2020-12); the `SiteContent` type in `src/content.types.ts` is
generated from it.

Workflow:
1. Read `content.schema.json` (the contract + `x-microservices` envelope).
2. Edit `src/content.json` — the existing values are a valid example. Respect
   `maxLength` and the `panel.features` bounds (3–6).
3. Verify: `npm run validate` (fast, path-pointed errors) — it also runs
   automatically before `npm run build`. Then `npm run dev` to preview.

## Other customization surfaces (NOT in content.json)

- **Brand colors & fonts** → `src/app.css` design tokens. See `THEMING.md`.
- **Signup, login, app, and admin screens** → still hardcoded in their `.svelte`
  components. Not externalized yet; edit in place if needed, carefully.

## Don't

- Don't edit `src/content.types.ts` — it's generated from the schema.
- Don't add fields not in the schema (`additionalProperties: false`; `npm run
  validate` and `npm run build` will fail).
- Don't hand-edit `src/routes/+page.svelte` for copy — change `src/content.json`.

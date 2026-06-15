# API Boundary

This template is a **pure static site**. It has no server, no API routes, no
database, and no auth. There is nothing to detach because there is no runtime
request handling at all — every page is rendered to HTML at build time and
uploaded as static assets.

## Layers

| Layer | Owns | Example |
|-------|------|---------|
| Content | the single source of truth for all copy and the brand accent | `src/content.json` |
| Content contract | field shapes, limits, and per-field hints (JSON Schema) | `content.schema.json` |
| Build-time validation | rejects invalid content before a build is produced | `scripts/validate-content.mjs` |
| Pages / components | render content to static HTML (do not hold data) | `src/pages/`, `src/components/` |
| Static host | serves the built `./dist` assets | Cloudflare static assets (`wrangler.jsonc`) |

## There is no server boundary

- **No endpoints.** No `/api/*` routes, no `+server.ts`, no Hono/Worker entry.
  `wrangler.jsonc` has no `main` — only an `assets` block pointing at `./dist`.
- **No auth.** Nothing is gated; there are no sessions, tokens, or cookies.
- **No database.** No D1, KV, or any binding. The template declares zero modules
  (`microservices.template.json` → `modules.required: []`).
- **No secrets.** Nothing reads environment secrets at request time because there
  is no request time.

## The only "boundary" is build-time content

All dynamic-looking values are resolved at build:

```txt
src/content.json          (data the customer edits)
  -> validated against content.schema.json by scripts/validate-content.mjs
  -> consumed by Astro pages/components
  -> astro build -> ./dist (static HTML/CSS/assets)
  -> uploaded to the static host
```

The contract a customizing agent must respect is therefore **the content schema**,
not an HTTP contract. Edit `src/content.json`; keep it valid against
`content.schema.json`; never introduce server code, routes, or modules — doing so
would change the template's category from a static marketing site to an app and
break this boundary.

## If a real API is ever needed

Adding server behavior (forms, auth, persistence) is **out of scope** for this
template. It would mean migrating to an SSR framework template (e.g. the
SvelteKit templates) that owns route adapters over `@microservices-sh/*` module
use cases — a deliberate, approval-gated change, not an in-place edit here.

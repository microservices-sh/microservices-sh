# Agent Guide: Company Landing (Astro)

This template is a **pure static** company landing / marketing page built with
Astro (`astro.config.mjs` → `output: "static"`). It has **no SSR adapter, no
server, no API, no database, and no modules**. It builds to `./dist` and uploads
to a static host.

All copy and the brand accent are **data**. To make it the customer's site you
edit one file: `src/content.json`. Everything else renders from it.

## Key Files

- `astro.config.mjs` — static config; set `site` to the production origin.
- `intake.schema.json` — short wizard/agent intake for company facts, offerings,
  contact details, and asset paths.
- `src/content.json` — the single source of truth for all copy + `theme.accent`.
- `content.schema.json` — the content contract (JSON Schema, draft 2020-12) with
  per-field `x-hint` and an `x-microservices` envelope (write target + verify).
- `scripts/validate-content.mjs` — schema validator; runs on `npm run validate`
  and automatically as `prebuild` before `npm run build`.
- `scripts/microservices.js` — workspace shim.
- `src/` (pages/components/layouts/styles) — render content; do not edit for copy.

## First Safe Commands

```bash
npm run validate                                   # fast content schema check
npm run dev                                        # local preview
npm run build                                       # prebuild validate + astro build -> ./dist
node ../../packages/workspace-tools/src/index.js check template --path .
```

## Rules

1. Read `microservices.template.json`, `microservices.lock.json`,
   `intake.schema.json`, `content.schema.json`, and `docs/llms.txt` before
   editing.
2. Edit `src/content.json` only for content. Keep it valid against
   `content.schema.json` (`additionalProperties: false`).
3. Keep it static. Do not add an SSR adapter, server, API routes, database, or
   modules unless intentionally migrating to a different template — that is an
   approval-gated change, not an in-place edit.
4. Respect content constraints: exactly 3 features / process steps / pricing
   plans; `features[].icon` ∈ {engineering, design, performance}; exactly one
   plan `featured: true`; `maxLength` on every string.
5. Set `theme.accent` (one `#rrggbb`) for brand color — do not edit
   `src/styles/tokens.css`.
6. Do not edit `src/site.config.ts` (it only types the content).
7. Always validate before build; the build fails on any schema violation.
8. Set `site` in `astro.config.mjs` to the customer's production origin.

## Check Command

```bash
node ../../packages/workspace-tools/src/index.js check template --path .
```

## Current Status

The template is a working static Astro landing page: content-driven via
`src/content.json` with a JSON-Schema contract, a build-time content validator,
and zero backend modules. It passes the workspace template contract check.

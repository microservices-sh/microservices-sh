# Customization Boundaries

## Ownership

- Template owns app shell, routes, layout, UI overlays, content files, adapters, and generated command wiring.
- Modules own domain behavior, schemas, use cases, ports, migrations, permissions, events, hooks, and provider adapters.
- App overlays own project-specific glue around module contracts.

## Default Path

1. Config for values and toggles.
2. Hooks for domain behavior variants.
3. Overlays for app-specific routes/UI/adapters.
4. Fork only when the module contract is wrong for the product.

## Files To Prefer

- `microservices.config.json` for app/module config.
- `src/content.json`, `content.schema.json`, or theme docs for content/design.
- `docs/api-boundary.md` for route ownership.
- `modules/<id>/src/hooks.ts` or documented hook exports for extension.
- `src/lib/server/*` adapters for SvelteKit glue.
- `microservices.check.mjs` and smoke scripts for acceptance coverage.

## Fork Warning

Editing module internals may be correct, but report the upgrade burden clearly. If the change is generally useful, prefer authoring an upstream module change with `microservices-authoring`.

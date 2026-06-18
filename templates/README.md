# Official Templates

Official templates live in this repo until the module contract, create package, and upgrade workflow are stable enough to split into separate repositories.

Each template must be self-contained:

- `microservices.template.json`
- `microservices.config.json`
- `microservices.lock.json`
- `README.agent.md`
- LLM-readable docs
- project CLI commands
- tests or smoke checks
- shared `check:spec` script through `packages/workspace-tools`
- no hidden dependency on another template folder

Templates may share modules and SDK code through workspace packages, but generated output must remain source-visible and exportable.

## Current Templates

| Template | Status | Purpose |
|----------|--------|---------|
| `booking-sveltekit` | runnable shell | Full Cloudflare SvelteKit booking app with detached booking API/domain logic. |
| `dot-ai-os` | draft | Agent-native operator OS with task board, focus planning, calendar context, daily review, knowledge/content pipelines, AI team routing, files, team roles, and module-backed work surfaces. |
| `wordpress-emdash-blog-astro` | experimental | WordPress blog migration to Astro + EmDash on Cloudflare Workers with exporter-first content import, theme ZIP intake, D1/R2, and source probing. |

## Future Split Rule

Keep templates here until at least five serious templates exist or external template authors need independent release workflows. At that point, split into a dedicated `microservices-templates` repo or publish each template as a package while preserving the same template manifest contract.

## New Template Start

```bash
pnpm scaffold:template -- invoice-sveltekit --framework sveltekit --modules customer,booking
pnpm spec:check -- template templates/invoice-sveltekit
```

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

## Future Split Rule

Keep templates here until at least five serious templates exist or external template authors need independent release workflows. At that point, split into a dedicated `microservices-templates` repo or publish each template as a package while preserving the same template manifest contract.

## New Template Start

```bash
pnpm scaffold:template -- invoice-sveltekit --framework sveltekit --modules customer,booking
pnpm spec:check -- template templates/invoice-sveltekit
```

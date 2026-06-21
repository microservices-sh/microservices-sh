# Template Specs

Templates are predefined starting repositories for generated apps. They are not disconnected boilerplates. Each template must be composed from module contracts, include a lockfile, expose LLM-readable docs, and support upgrade planning.

Bundled application shells such as `booking-sveltekit`, `accounting-erp-sveltekit`, and `commerce-ops-sveltekit` are exposed through `create-microservices-app`. The root `microservices generate` command is still the procedural Worker generator backed by `module-contract`.

## Current Specs

- `template-spec-standard.md` - standard every template spec must follow.
- `stacksuite-porting-plan.md` - technical plan for porting the StackSuite accounting and invoice source projects into modules and focused CLI templates.
- `content-contracts.md` - convention for agent-editable content (content.json + schema + generated types + validator + CLAUDE.md).
- `booking-sveltekit.md` - full Cloudflare SvelteKit booking app template spec.
- `../../templates/booking-sveltekit` - concrete booking template shell in this repo.
- `../../templates/accounting-erp-sveltekit` - StackSuite-derived accounting ERP shell with ledger, payables, receivables, bank reconciliation, invoices, and payments.
- `../../templates/commerce-ops-sveltekit` - StackSuite-derived commerce operations shell with catalog, inventory, sales orders, fulfillment, commerce sync, invoices, and payments.

## Template Rule

A template can own app shell, routing, layout, sample content, and composition glue. Domain behavior must live in modules or documented template hooks so agents can customize safely and upgrades remain possible.

## Recommended Order

1. `booking-sveltekit` - full booking product proof with UI, API routes, D1, KV, hooks, and managed preview.
2. `accounting-erp-sveltekit` - focused accounting ERP proof for StackSuite ledger, AP, AR, bank reconciliation, invoices, and payments.
3. `commerce-ops-sveltekit` - focused commerce operations proof for products, inventory, orders, fulfillment, sync, invoices, and payments.
4. `landing-page` - marketing site with waitlist/contact capture and analytics.
5. `blog-content` - content foundation with posts, authors, tags, RSS/sitemap, SEO metadata, and optional email capture.

The future generated `landing-page` template is distinct from the private `microservices-sh/landing-page` marketing-site repo.

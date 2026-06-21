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
| `booking-sveltekit` | ready | Full Cloudflare SvelteKit booking app with public booking flow, admin screens, D1, detached booking/customer modules, local setup, and smoke checks. |
| `client-portal-sveltekit` | ready | Auth-gated Cloudflare SvelteKit client portal where customers see their own invoices, files, and account data; staff get an admin side. |
| `company-landing-astro` | ready | Static Astro company landing page with content contract and no backend modules. |
| `erp-shell-sveltekit` | ready | Single-company ERP shell for customers, invoices, files, support tickets, teams, admin, and audit-log-backed operations. |
| `commerce-ops-sveltekit` | ready | StackSuite-derived commerce operations shell with product catalog, inventory, sales orders, fulfillment, commerce sync, invoices, payments, files, and jobs. |
| `accounting-erp-sveltekit` | ready | StackSuite-derived accounting ERP shell with general ledger, payables, receivables, bank reconciliation, invoices, payments, webhooks, and jobs. |
| `saas-starter-sveltekit` | ready | Multi-tenant B2B SaaS starter with org sign-up, team RBAC, subscriptions, admin shell, and audit log. |
| `dot-ai-os` | private pilot | Agent-native operator OS with task board, focus planning, calendar context, daily review, knowledge/content pipelines, AI team routing, files, team roles, and module-backed work surfaces. Hidden from public create-app template lists; scaffold only by exact template id for private pilots. |
| `erp-shell-desktop-tauri` | draft | Mac and Windows desktop companion for ERP Shell: local document intake, extraction queue review, runtime status, and approved-draft ERP import. |
| `wordpress-emdash-blog-astro` | experimental | WordPress blog migration to Astro + EmDash on Cloudflare Workers with exporter-first content import, theme ZIP intake, D1/R2, and source probing. |

The public launch path should lead with `booking-sveltekit` through `create-microservices-app` and the generated project CLI. The root workspace CLI is for internal SDK/control-plane development until its template catalog is synced with the create-package registry.

## Future Split Rule

Keep templates here until at least five serious templates exist or external template authors need independent release workflows. At that point, split into a dedicated `microservices-templates` repo or publish each template as a package while preserving the same template manifest contract.

## New Template Start

```bash
pnpm scaffold:template -- invoice-sveltekit --framework sveltekit --modules customer,booking
pnpm spec:check -- template templates/invoice-sveltekit
```

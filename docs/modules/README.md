# Module Documentation

This directory is the human-readable module catalog for microservices.sh.

The module docs are intentionally broader than Swagger/OpenAPI. OpenAPI documents HTTP routes, payloads, and responses. A microservices.sh module also needs to describe resources, secrets, events, hooks, permissions, migrations, source-code ownership, and upgrade behavior so a developer agent can safely install and modify it.

## Standard

Use [`module-spec-standard.md`](./module-spec-standard.md) as the source of truth for module documentation.

Use [`module-package-structure.md`](./module-package-structure.md) as the source of truth for module folder layout, entrypoints, exports, and overlay structure.

For LLM agents, use [`../llms.txt`](../llms.txt) and [`catalog.json`](./catalog.json) as the compact discovery layer before reading individual module pages.

Every module should have:

- a Markdown reference page in this directory
- a machine-readable `module.json`
- an OpenAPI document for public HTTP routes
- a safe `src/index.ts` entrypoint
- predictable `src/` files for routes, services, schemas, hooks, events, permissions, resources, and optional provider/webhook logic
- folder-level `index.ts` re-exports for each top-level concern
- JSON Schema or Zod schemas for config, events, hooks, and payloads
- migration and resource requirements
- permission and approval metadata
- agent notes and failure modes

## LLM Accessibility Requirements

These docs must be easy for coding agents to retrieve and reason over:

- stable file paths
- one module per Markdown file
- one standard module package layout
- one canonical `src/index.ts` entrypoint
- one `src/<concern>/index.ts` barrel per top-level concern folder
- compact machine-readable catalog in `catalog.json`
- explicit status values: `available`, `planned`, `deprecated`
- explicit risk levels and approval gates
- no critical information hidden in screenshots or diagrams
- request/response examples as fenced JSON
- predictable headings across every module page
- source ownership and upgrade behavior documented before install

Future MCP/CLI tools should expose the same content through:

- `list_module_docs`
- `get_module_doc`
- `get_module_openapi`
- `get_module_manifest`
- `explain_module_permissions`

## Current MVP Docs

| Module | Status | Purpose |
|--------|--------|---------|
| [`auth`](./auth.md) | Available | EdDSA service-token mint/verify, scope checks, and JWKS for inter-service auth. |
| [`identity`](./identity.md) | Available | Passwordless email-code login, server-side sessions, and scoped service-token bridging through auth. |
| [`gateway`](./gateway.md) | Available | Public trust boundary: API-key auth, rate limiting, scope narrowing, token exchange via auth. |
| [`customer`](./customer.md) | Available | Customer profiles, tags, consent fields, and customer events. |
| [`org-team-rbac`](./org-team-rbac.md) | Available | Organizations, memberships, roles, invitations, and tenant-scoped permission resolution. |
| [`admin-shell`](./admin-shell.md) | Available | Schema-driven admin CRUD over host D1 tables with RBAC, search, pagination, and audit hooks. |
| [`file-media`](./file-media.md) | Available | R2-backed file uploads, upload tickets, owner-scoped listing, soft-deletes, and media lifecycle events. |
| [`jobs-workflows`](./jobs-workflows.md) | Available | Durable jobs, schedules, deterministic workflows, retry backoff, artifacts, and dead-letter handling. |
| [`notifications-inapp`](./notifications-inapp.md) | Available | Per-user notification feed with read/unread state, reconnect catch-up, and idempotent delivery. |
| [`support-ticket`](./support-ticket.md) | Available | Tenant-scoped support tickets, comments, attachments, assignment, and public follow-up links. |
| [`ads-manager`](./ads-manager.md) | Available | Cross-platform ad monitoring over entitlement-gated upstream connector access. |
| [`billing-subscriptions`](./billing-subscriptions.md) | Available | Recurring plans, subscriptions, Stripe lifecycle, plan changes, and dunning hooks. |
| [`forms-intake`](./forms-intake.md) | Available | Dynamic forms, submissions, validation, Turnstile, and attachment references. |
| [`image-generation`](./image-generation.md) | Available | Pluggable image generation and editing with D1 gallery metadata and R2 image bytes. |
| [`invoice`](./invoice.md) | Available | Gapless invoicing, recurring templates, lifecycle state, payment links, and invoice events. |
| [`membership-credits`](./membership-credits.md) | Draft | Membership tiers, active memberships, credit balances, and credit ledger transactions. |
| [`operator-work`](./operator-work.md) | Draft | Agent-readable task board, focus plan, and daily review state for operator work. |
| [`project-progress`](./project-progress.md) | Draft | Project timelines, logs, access grants, media/comments, and public snapshots. |
| [`sms-campaigns`](./sms-campaigns.md) | Draft | Opted-in SMS contacts, groups, templates, campaign scheduling, dispatch, and delivery callbacks. |
| [`storage-entitlements`](./storage-entitlements.md) | Draft | Storage quotas, packages, purchases, owner usage accounting, and share-link controls. |
| [`support-inbox`](./support-inbox.md) | Draft | Support widget and inbox conversations, messages, channel metadata, and agent takeover. |
| [`product-catalog`](./product-catalog.md) | Draft | Product/category catalog, SKU uniqueness, external mappings, and combo products. |
| [`inventory`](./inventory.md) | Draft | Tenant-scoped stock movements, reservations, deductions, reconciliation documents, low-stock alerts, and balances. |
| [`sales-order`](./sales-order.md) | Draft | Sales orders, line items, status transitions, reservation handoff, and invoice draft handoff. |
| [`shipment`](./shipment.md) | Draft | Shipment batches, fulfillment workflow, idempotent completion, and shipment events. |
| [`commerce-sync`](./commerce-sync.md) | Draft | Commerce connections, mappings, sync runs, webhook receipts, and normalized payload envelopes. |
| [`accounting-core`](./accounting-core.md) | Draft | Double-entry accounting foundation, chart of accounts, fiscal periods, posting, voiding, and trial balance. |
| [`accounts-payable`](./accounts-payable.md) | Draft | Vendors, bills, payable lifecycle, recurring bill templates, payment application, and aging. |
| [`accounts-receivable`](./accounts-receivable.md) | Draft | Customer payment application, open receivables, aging, and statement workflows. |
| [`bank-reconciliation`](./bank-reconciliation.md) | Draft | Bank accounts, imported transactions, statement lines, matching, and reconciliation state. |
| [`estimate-quote`](./estimate-quote.md) | Draft | Estimate/quote documents, lifecycle transitions, conversion metadata, and invoice draft handoff. |
| [`recurring-documents`](./recurring-documents.md) | Draft | Recurring invoice/bill templates, due-cycle generation, lifecycle state, and draft document handoff. |
| [`knowledge-base-rag`](./knowledge-base-rag.md) | Draft | Tenant-scoped knowledge articles, grounded answers, and draft-only support replies. |
| [`booking`](./booking.md) | Available | Service booking, availability, cancellation, and booking events. |
| [`payment`](./payment.md) | Available | Stripe-backed payment provider: payment intents, payment records, and signed webhook verification. |
| [`idempotency`](./idempotency.md) | Available | Scoped idempotency records for safe retry, replay, and duplicate side-effect prevention. |
| [`email`](./email.md) | Available | Transactional email delivery ports, provider adapters, and delivery events. |
| [`audit-log`](./audit-log.md) | Available | Append-only audit trail; pure event sink with signed-envelope verification. |
| [`marketing-research`](./marketing-research.md) | Available | Cite-or-refuse market research briefs with swappable signal/synthesis ports and approval-gated external fetches. |
| [`webhook-delivery`](./webhook-delivery.md) | Available | Outbound mirror of the event bus: HMAC-signed event delivery to external endpoints with delivery logging. |

## Version Selection

Module commands accept exact version selectors:

```bash
pnpm microservices add payment@0.1.0 --plan --json
pnpm microservices add payment --version 0.1.0 --plan --json
pnpm microservices add payment --apply --json
pnpm microservices remove payment --apply --json
pnpm microservices upgrade booking --to 0.1.0 --plan --json
npm create microservices-app@latest my-app -- --modules auth@0.1.0,booking
```

The current registry snapshot exposes one available version per module. If a requested version is not in that snapshot, commands return `MODULE_VERSION_NOT_FOUND` with `availableVersions` instead of silently installing the current version. `add/remove --apply` mutates the local module manifest and lockfile; use `--plan` first when reviewing side effects.

Generated SvelteKit apps resolve versioned module source through release tags named `modules/<module-id>/v<version>`, for example `modules/payment/v0.1.0`. If the tag is unavailable, the local `add` command returns `MODULE_SOURCE_REF_NOT_FOUND` instead of silently using the current source snapshot. Unversioned adds still use the current source snapshot. A future registry-artifact URL can reuse the same source-ref shape.

## Naming

Use these module classes:

- **Core modules**: first-party product primitives such as `auth`, `customer`, `booking`, `audit-log`.
- **Provider modules**: full third-party service implementations such as `payment-stripe`, `email-resend`, `calendar-google`.
- **Template packs**: compositions such as `booking-business`.
- **Connectors**: internal low-level clients used by provider modules. Users should normally see provider modules, not connectors.

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
| [`booking`](./booking.md) | Available | Service booking, availability, cancellation, and booking events. |
| [`payment`](./payment.md) | Available | Stripe-backed payment provider: payment intents, payment records, and signed webhook verification. |
| [`idempotency`](./idempotency.md) | Available | Scoped idempotency records for safe retry, replay, and duplicate side-effect prevention. |
| [`email`](./email.md) | Planned | Transactional email sending, templates, jobs, and delivery events. |
| [`audit-log`](./audit-log.md) | Available | Append-only audit trail; pure event sink with signed-envelope verification. |
| [`marketing-research`](./marketing-research.md) | Available | Cite-or-refuse market research briefs with swappable signal/synthesis ports and approval-gated external fetches. |
| [`webhook-delivery`](./webhook-delivery.md) | Available | Outbound mirror of the event bus: HMAC-signed event delivery to external endpoints with delivery logging. |

## Version Selection

Module commands accept exact version selectors:

```bash
pnpm microservices add payment@0.1.0 --plan --json
pnpm microservices add payment --version 0.1.0 --plan --json
pnpm microservices upgrade booking --to 0.1.0 --plan --json
npm create microservices-app@latest my-app -- --modules auth@0.1.0,booking
```

The current registry snapshot exposes one available version per module. If a requested version is not in that snapshot, commands return `MODULE_VERSION_NOT_FOUND` with `availableVersions` instead of silently installing the current version.

Generated SvelteKit apps resolve versioned module source through release tags named `modules/<module-id>/v<version>`, for example `modules/payment/v0.1.0`. If the tag is unavailable, the local `add` command returns `MODULE_SOURCE_REF_NOT_FOUND` instead of silently using the current source snapshot. Unversioned adds still use the current source snapshot. A future registry-artifact URL can reuse the same source-ref shape.

## Naming

Use these module classes:

- **Core modules**: first-party product primitives such as `auth`, `customer`, `booking`, `audit-log`.
- **Provider modules**: full third-party service implementations such as `payment-stripe`, `email-resend`, `calendar-google`.
- **Template packs**: compositions such as `booking-business`.
- **Connectors**: internal low-level clients used by provider modules. Users should normally see provider modules, not connectors.

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
| [`auth`](./auth.md) | Available | Passwordless identity, sessions, roles, and auth events. |
| [`customer`](./customer.md) | Available | Customer profiles, tags, consent fields, and customer events. |
| [`booking`](./booking.md) | Available | Service booking, availability, cancellation, and booking events. |
| [`payment-stripe`](./payment-stripe.md) | Planned | Full Stripe payment workflow module, not just credential storage. |
| [`email`](./email.md) | Planned | Transactional email sending, templates, jobs, and delivery events. |
| [`audit-log`](./audit-log.md) | Planned | Mutation audit trail and domain event recording. |

## Naming

Use these module classes:

- **Core modules**: first-party product primitives such as `auth`, `customer`, `booking`, `audit-log`.
- **Provider modules**: full third-party service implementations such as `payment-stripe`, `email-resend`, `calendar-google`.
- **Template packs**: compositions such as `booking-business`.
- **Connectors**: internal low-level clients used by provider modules. Users should normally see provider modules, not connectors.

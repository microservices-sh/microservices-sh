# Module Specification Standard

Generated: 2026-06-13

## Decision

Each microservices.sh module needs a Swagger-like API reference, but the module contract must be broader than Swagger.

Use this model:

```text
Module Specification = OpenAPI + module manifest + schemas + events + hooks + resources + permissions + upgrade policy
```

OpenAPI is the right artifact for HTTP routes. It is not enough for agent-safe module installation because it does not explain which D1 tables, KV namespaces, queues, secrets, third-party APIs, permission scopes, lifecycle events, and upgrade constraints a module introduces.

## Required Artifacts

Each module package should include:

```text
module.json
openapi.json
README.md
README.agent.md
llms.txt
schemas/
  config.schema.json
  events.schema.json
  hooks.schema.json
migrations/
  0001_initial.sql
seeds/
tests/
examples/
```

For TypeScript/Hono modules, generated source should also include:

```text
src/modules/<module-id>/
  index.ts
  routes/index.ts
  service/index.ts
  schema/index.ts
  hooks/index.ts
  permissions/index.ts
  resources/index.ts
```

MVP generated examples may keep modules as flat files, but the target module package format is directory based.

See [`module-package-structure.md`](./module-package-structure.md) for the canonical folder layout and `src/index.ts` entrypoint contract.

## Module Entrypoint

Every module has one canonical code entrypoint:

```text
src/index.ts
```

The entrypoint exports a `moduleDefinition` and related typed artifacts. It must be safe to import. Importing a module must not create resources, call third-party APIs, run migrations, read secret values, start jobs, or mutate request-scoped state.

Side effects happen only through explicit generated app runtime calls, SDK calls, MCP tools, CLI commands, queue consumers, or deployment pipeline actions.

Each top-level concern folder should also expose an `index.ts` barrel. This gives agents stable import paths such as `../schema`, `../service`, and `../hooks` while allowing leaf files to change internally.

## LLM Accessibility

Module documentation is a product surface. Agents must not need to scrape the marketing site or infer behavior from source code alone.

Required LLM-facing properties:

- stable paths and stable IDs
- one module per Markdown file
- one compact catalog file at `docs/modules/catalog.json`
- one global LLM guide at `docs/llms.txt`
- consistent headings across module docs
- explicit request and response JSON examples
- explicit permission, secret, migration, and deployment approval gates
- no required information stored only in images, screenshots, or diagrams
- short summaries that fit into MCP tool responses
- complete docs available through MCP/CLI in addition to repo files

MCP/CLI should eventually expose:

| Tool | Purpose |
|------|---------|
| `list_module_docs` | Return compact doc metadata and doc paths. |
| `get_module_doc` | Return the Markdown reference for one module. |
| `get_module_openapi` | Return the module OpenAPI document. |
| `get_module_manifest` | Return `module.json`. |
| `explain_module_permissions` | Return risk and approval summary for a module install/update. |

Do not require an agent to use a browser UI to understand module behavior.

## `module.json` Shape

```json
{
  "id": "payment-stripe",
  "name": "Stripe Payment",
  "version": "0.1.0",
  "class": "provider",
  "status": "planned",
  "summary": "Stripe checkout, payment links, products, webhooks, refunds, and payment records.",
  "requires": ["auth", "customer"],
  "optional": ["audit-log", "email"],
  "runtime": {
    "platform": "cloudflare-workers",
    "framework": "hono",
    "mount": "/payments",
    "bindings": ["DB", "PAYMENT_QUEUE"]
  },
  "storage": {
    "d1": ["payment_customers", "payment_products", "payment_sessions", "payment_events"],
    "kv": [],
    "r2": [],
    "queues": ["payment-webhooks"]
  },
  "secrets": [
    { "name": "STRIPE_SECRET_KEY", "scope": "module", "environment": ["preview", "production"] },
    { "name": "STRIPE_WEBHOOK_SECRET", "scope": "module", "environment": ["preview", "production"] }
  ],
  "vars": ["STRIPE_MODE", "APP_URL"],
  "outbound": ["api.stripe.com"],
  "permissions": ["payment.read", "payment.write", "payment.admin"],
  "approval": {
    "risk": "high",
    "requiredFor": ["install", "secrets", "webhook", "productionDeploy", "migration"]
  },
  "eventsEmitted": ["payment.succeeded", "payment.failed"],
  "eventsConsumed": ["booking.created"],
  "hooks": ["beforeCheckoutCreate", "afterPaymentSucceeded"],
  "upgrade": {
    "defaultMode": "pinned",
    "safeCustomization": ["config", "hooks", "overlays"],
    "manualCustomization": ["fork"]
  }
}
```

## Documentation Sections

Every Markdown module page must include:

1. **Purpose**
2. **When To Use**
3. **When Not To Use**
4. **Dependencies**
5. **Runtime And Resources**
6. **Secrets And Environment**
7. **Permissions And Approval Gates**
8. **Routes**
9. **Payloads And Responses**
10. **Events**
11. **Hooks**
12. **Database Tables**
13. **Customization**
14. **Upgrade Notes**
15. **Failure Modes**
16. **Agent Checklist**

## Route Documentation

Document routes in a compact OpenAPI-like table:

| Method | Path | Auth | Permission | Purpose |
|--------|------|------|------------|---------|
| `POST` | `/payments/checkout` | Required | `payment.write` | Create a checkout session. |

Then define payloads and responses:

```json
{
  "customerId": "cus_local_123",
  "lineItems": [{ "priceId": "price_123", "quantity": 1 }],
  "successUrl": "https://app.example.com/success",
  "cancelUrl": "https://app.example.com/cancel"
}
```

```json
{
  "ok": true,
  "checkout": {
    "id": "cs_test_123",
    "url": "https://checkout.stripe.com/c/pay/cs_test_123",
    "status": "open"
  }
}
```

## Permission Gates

Use explicit risk levels:

| Risk | Examples | Gate |
|------|----------|------|
| Low | Docs, local code generation, config-only changes | Agent can proceed after user intent. |
| Medium | New D1 table, KV namespace, queue, non-secret env var | User approval required. |
| High | Payment, email, auth, webhook, secret, PII access, production deploy | User approval plus audit log required. |
| Critical | Delete data, rotate auth secret, change billing flow, production rollback | Strong confirmation required. |

The agent can propose a plan. microservices.sh must enforce the approval gate before secrets, paid resources, production deployments, destructive changes, or third-party account changes.

## Secrets And Source Code

Rules:

- Never commit secrets to the generated repo.
- Store secret values only in a secret manager or Cloudflare Worker secrets.
- Let agents see secret names, scopes, and status, not values.
- Scope secrets by workspace, project, environment, and module instance.
- Use separate preview and production secrets.
- Shared secrets must be explicitly marked shared; module-private secrets are the default.

Recommended secret path:

```text
workspace/<workspace-id>/project/<project-id>/env/<env>/module/<module-id>/<secret-name>
```

## Source Ownership

Default mode:

1. User brings a GitHub repo or microservices.sh creates one.
2. The agent installs or updates modules on a branch.
3. microservices.sh opens a PR or produces a patch.
4. Checks run.
5. Preview deploy can be managed by microservices.sh.
6. Production deploy requires explicit approval.

Deployment modes:

| Mode | Source owner | Deployer | MVP priority |
|------|--------------|----------|--------------|
| Relay deploy | User repo | User GitHub Actions or connected Cloudflare | High |
| Managed preview | User repo or generated artifact | microservices.sh | High |
| Managed production | User repo remains exportable | microservices.sh | Medium |
| BYO Cloudflare | User repo and user Cloudflare account | User/microservices.sh relay | Later |

## Upgrade Policy

Every app must keep a lockfile:

```json
{
  "modules": {
    "booking": {
      "version": "0.1.0",
      "source": "registry:booking@0.1.0",
      "customizationMode": "config-hooks",
      "checksum": "sha256:..."
    }
  }
}
```

Upgrade behavior:

- **Config and hooks**: upgradeable with automated checks.
- **Overlays**: upgradeable with merge review.
- **Forks**: manual or agent-assisted upgrades only.
- **Migrations**: always require approval and rollback notes.

## Agent-Facing Requirements

An agent should be able to answer these questions from module docs alone:

- Should I use this module for the user's requirement?
- What dependencies does it add?
- What routes, payloads, and responses become available?
- Which secrets and env vars are required?
- Which Cloudflare resources will be created?
- Which third-party APIs will be called?
- Which permissions and PII fields are accessed?
- Which hooks can I customize safely?
- Which edits make upgrades harder?
- What tests must pass before deploy?

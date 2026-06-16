---
name: microservices-app-customizer
description: Customize generated microservices.sh apps safely. Use inside a generated app when changing config, hooks, overlays, routes, UI, content, schemas, admin screens, smoke checks, or module behavior without breaking upgrade contracts.
---

# microservices.sh App Customizer

Use this skill inside a generated microservices.sh app. Preserve the user's source ownership while avoiding unnecessary module forks.

## First Read

Read the app-local contracts before editing:

- `README.agent.md`
- `docs/llms.txt`
- `microservices.template.json`
- `microservices.config.json`
- `microservices.lock.json`
- `docs/api-boundary.md` when changing routes or server adapters
- Module `README.agent.md`, `module.json`, `openapi.json`, and `llms.txt` before changing module-owned behavior

If a file is absent, continue with the nearest available contract and report the gap.

## Customization Ladder

Choose the lowest-risk path that satisfies the request:

1. Config: edit `microservices.config.json`, content JSON, theme tokens, or documented module config.
2. Hooks: edit documented hook points for validation, filtering, observers, or guards.
3. Overlay: add app-owned routes, adapters, UI, schema extensions, or admin resources around the module.
4. Fork: edit module internals only when the user accepts manual upgrade burden.

Keep app route handlers thin. Put domain behavior in documented use cases, services, hooks, or adapters.

Read `references/customization-boundaries.md` when ownership or extension style is unclear.

## Workflow

1. Identify which surface owns the behavior: template, module, generated app overlay, provider adapter, or deploy control plane.
2. Inspect existing checks before editing: `pnpm microservices check --json`, template `microservices.check.mjs`, and package scripts.
3. Make scoped changes only in the owning surface.
4. Update docs/contracts when behavior, routes, resources, config, or commands change.
5. Run the narrowest meaningful check, then the generated-app check.

## Approval Gates

Ask before changing:

- Auth, sessions, signing keys, scopes, permissions, tenant isolation, or admin access.
- PII fields, customer data, booking/invoice/payment data, audit logs.
- Payment, email, webhook, calendar, image, ads, or other external provider behavior.
- D1/KV/R2/Queue resources, migrations, secrets, preview deploys, production deploys, or destructive actions.

Never ask the user to paste secrets into chat. Discuss names, scopes, and where to configure them.

## Finish Checklist

Report:

- Surface changed and why it was the right ownership boundary.
- Contracts/docs read.
- Files changed.
- Checks run and result.
- Approval-gated work intentionally left as a plan.

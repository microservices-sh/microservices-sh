---
name: microservices-production-readiness
description: Audit a microservices.sh app before pilot, client handoff, preview, or production. Use for launch readiness, security review, tenant isolation review, auth/payment/email/webhook checks, migration safety, secrets, observability, and deployment go/no-go.
---

# microservices.sh Production Readiness

Use this skill when the user needs confidence before a pilot, client handoff, preview deploy, or production launch. Treat the app as source-visible but safety-critical.

## Inputs To Gather

Read:

- `README.agent.md`, `docs/llms.txt`, `docs/api-boundary.md`
- `microservices.template.json`, `microservices.config.json`, `microservices.lock.json`
- `wrangler.jsonc`, migrations, smoke scripts, and package scripts
- Relevant module docs/manifests for auth, identity, org/team, payment, billing, email, webhooks, files, audit, jobs, and admin

Run read-only checks first:

```bash
pnpm microservices check --json
pnpm microservices secrets status --json
pnpm microservices updates --json
```

If commands are unavailable, inspect the equivalent files and explain the limitation.

## Review Areas

Use `references/readiness-checklist.md` for the detailed checklist. Prioritize:

- Auth and session boundaries.
- Tenant isolation and RBAC.
- PII access, customer data, bookings, invoices, files, and audit logs.
- Payment, subscription, email, webhook, calendar, ads, and image-provider side effects.
- Migrations, resource bindings, secrets, and local vs remote data.
- Admin screens and generic CRUD permissions.
- Deploy plan, rollback path, smoke tests, and monitoring/telemetry.

## Severity Model

- Blocker: data leak, auth bypass, tenant leak, money mutation risk, destructive deploy/migration risk, missing required secret/resource.
- High: unverified provider webhook/email/payment path, admin overreach, missing audit for sensitive workflow, unchecked migration.
- Medium: incomplete smoke coverage, unclear ownership boundary, stale docs, missing telemetry event, weak failure handling.
- Low: docs polish, naming, minor UX gaps.

## Output Contract

Lead with go/no-go:

- `Go`: no blockers or high-risk unverified paths.
- `Go after fixes`: concrete fixes are small and local.
- `No-go`: blockers remain or remote/provider actions are not safely planned.

Then list findings by severity with file/line references when available, checks run, and approval-gated steps that were not executed.

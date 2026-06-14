## Summary

Describe the behavior change and why it is needed.

## Feature List

List concrete capabilities added or changed. Keep this factual, not marketing copy.

- 

## Surface

- [ ] create package
- [ ] project CLI
- [ ] internal SDK
- [ ] API/control plane
- [ ] MCP
- [ ] module
- [ ] template
- [ ] docs
- [ ] CI/release

## Risk

- [ ] no user-facing behavior change
- [ ] changes generated source
- [ ] changes JSON response shape
- [ ] changes migrations/resources/bindings
- [ ] touches secrets/auth/PII
- [ ] touches provider side effects
- [ ] touches deployment or production gates

## Runtime Requirements

Required when the PR adds or changes env vars, secrets, bindings, provider credentials, Cloudflare resources, or generated app setup.

| Name | Type | Required | Local setup | Production setup | Notes |
| --- | --- | --- | --- | --- | --- |
| _none_ |  |  |  |  |  |

Types: `secret`, `var`, `binding`, `resource`, `provider-account`, `webhook`, `domain`.

Do not include secret values in the PR body, screenshots, fixtures, logs, or committed files.

## Resources And Migrations

- [ ] no resource or migration changes
- [ ] D1 migration included
- [ ] KV/R2/Queue/Workflow/DO binding changed
- [ ] external provider/API added or changed
- [ ] webhook route added or changed
- [ ] rollback notes included

Files and notes:

- 

## Provider / Security Checklist

Required for auth, payment, email, webhook, PII, secret, production deploy, or third-party provider changes:

- [ ] required secret names are documented, values are not committed
- [ ] provider scopes, account permissions, or domain requirements are documented
- [ ] idempotency, replay, or duplicate-delivery behavior is documented
- [ ] local/test mode works without production side effects
- [ ] production side effects require explicit approval
- [ ] failure, retry, and rollback behavior is documented
- [ ] no provider call, secret read, resource creation, migration, job start, or external mutation happens during import
- [ ] no provider call happens during build, scaffold, spec check, or docs generation

## Module Checklist

Required for module PRs:

- [ ] proposal issue linked, or maintainer notes explain why this private snapshot update is needed
- [ ] public `microservices-sh/modules` PR, commit, or tag linked when module internals changed
- [ ] `module.json` updated
- [ ] `README.md`, `README.agent.md`, and `llms.txt` updated
- [ ] schemas updated
- [ ] migrations included if storage changes
- [ ] hooks, events, permissions, resources, and secrets documented
- [ ] generated app integration path documented
- [ ] no side effects during import
- [ ] tests or smoke checks included
- [ ] approval gates documented for secrets, migrations, webhooks, provider calls, and production actions

## Checks

Paste the relevant command results. Delete commands that do not apply.

```bash
pnpm spec:check -- module modules/<module-id>
pnpm --filter @microservices-sh/<module-id> build
pnpm spec:check -- template templates/<template-id>
pnpm --filter @microservices-sh/template-<template-id> build:app
pnpm build
pnpm spec:check:all
pnpm test:create
```

## Review Gate

- [ ] non-author reviewer requested
- [ ] CODEOWNERS/security reviewers requested when touched areas require them
- [ ] merge waits for passing CI and non-author approval
- [ ] self-merge avoided unless this is an emergency and the reason is documented

## Notes For Reviewers

Call out compatibility, upgrade, lockfile, deployment, review-assignment, rollback, or known limitation concerns.

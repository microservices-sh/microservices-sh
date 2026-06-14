# Review Process

This is the review process for core repo changes, public module PRs, template PRs, and registry listings.

## Review Goals

Reviews protect:

- generated app trust
- module contract stability
- secret and provider safety
- upgradeability
- predictable agent behavior
- Cloudflare resource correctness
- public package and deployment safety

## Triage

Every incoming issue or PR should be classified by surface:

- `create package`
- `project CLI`
- `internal SDK`
- `API/control plane`
- `MCP`
- `module`
- `template`
- `registry`
- `docs`
- `CI/release`

Use labels for risk:

- `module-proposal`
- `provider-module`
- `security-review`
- `template`
- `bug`

Provider, auth, payment, email, webhook, migration, secret, PII, and deployment changes require security-aware review.

## Proposal Review

For module and template proposals, reviewers should decide one of:

| Decision | Meaning |
| --- | --- |
| Accepted for public module repo | May be implemented in `microservices-sh/modules` |
| Accepted for private core | May be implemented in this private repo because it touches create-app, CLI, API/control-plane, templates, or release glue |
| Registry-first | Should be listed or incubated outside core first |
| Needs research | Requires customer, security, API, or product validation |
| Declined | Does not fit the current product or risk model |

The default for third-party provider modules is registry-first or public-modules-first unless maintainers explicitly accept ownership.

## PR Review Checklist

Required for all PRs:

- PR description explains behavior change
- relevant checklist is completed
- CI passes
- changed machine-readable outputs are stable or intentionally versioned
- no secrets or credentials are committed
- docs are updated when behavior changes
- unrelated refactors are avoided

Required for modules:

- proposal issue is linked
- public module source PR is linked when this private PR imports a module snapshot
- module package shape passes `pnpm spec:check -- module modules/<module-id>`
- import-time safety is preserved
- secrets are names only, never values
- permissions, resources, hooks, events, migrations, and approval gates are documented
- tests cover core use cases and failure behavior
- generated app integration path is described

Required for provider modules:

- provider scopes are least-privilege
- webhook signatures are verified
- idempotency/replay behavior is covered
- local/test mode works without production credentials
- production side effects require explicit approval
- failure, retry, and rollback behavior is documented

Required for templates:

- template manifest is present
- `microservices.lock.json` is present
- `README.agent.md` and `docs/llms.txt` are present
- project CLI commands work
- module ownership boundaries are documented
- screenshot or HTTP smoke checks exist when the template has UI

## Required Checks

Core repo baseline:

```bash
pnpm build
pnpm spec:check:all
pnpm test:create
```

Module PRs:

```bash
pnpm spec:check -- module modules/<module-id>
pnpm --filter @microservices-sh/<module-id> build
```

Template PRs:

```bash
pnpm spec:check -- template templates/<template-id>
pnpm --filter @microservices-sh/template-<template-id> build:app
```

Registry PRs:

- validate JSON syntax
- verify required listing fields
- confirm links point to source, docs, package, or tests
- confirm maturity level matches evidence

## Approval Rules

Minimum approval:

- one maintainer review for normal changes
- module reviewer review for module contract or module source changes
- template reviewer review for template changes
- security review for provider, auth, secrets, PII, webhook, migration, CI/release, billing, payment, email, or production deployment changes
- approvals must come from a reviewer who is not the PR author

CODEOWNERS maps these areas to the relevant teams.

## Blocking Conditions

Block the PR if:

- it exposes or asks for secret values
- it performs side effects during import
- it bypasses explicit production approval gates
- it changes JSON contracts without versioning or migration notes
- it adds a provider integration without scopes, webhooks, tests, and failure behavior
- it weakens generated app inspectability or source ownership
- it cannot be checked locally or in CI
- ownership for a third-party module is unclear

## Merge Policy

Use squash merge for normal PRs.

Delete branches after merge.

Do not self-merge. If an emergency requires same-person author and merger, document the reason in the PR before merging.

Do not merge large mixed changes that combine product behavior, provider side effects, migrations, and docs unless there is a clear reason.

## Public/Private Module Flow

The public `microservices-sh/modules` repo is the normal review surface for module source. This private core repo may include pinned module snapshots under `modules/` so create-app and templates can build offline.

Private PRs that update `modules/` should state the source public modules commit, tag, or PR. Avoid private-only edits to module internals unless the change is release glue that cannot be public.

## Current Platform Limitation

The private core repo cannot enforce branch protection on the current GitHub plan. Until that changes, maintainers must follow this process manually for core repo merges.

The `PR Governance` workflow checks that PRs keep the standard body sections and Review Gate checklist. Treat it as a required review signal now, and configure it as a required status check once private-repo branch rules are available.

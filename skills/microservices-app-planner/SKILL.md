---
name: microservices-app-planner
description: Plan new microservices.sh applications. Use when a user wants to build an app, choose a template, select modules, compare starters, scope an MVP, or turn a product idea into a microservices.sh create-app command and implementation plan.
---

# microservices.sh App Planner

Use this skill before creating or substantially reshaping an app. Choose the smallest starter and module set that matches the user outcome, then make risks and checks explicit.

## Workflow

1. Clarify the app outcome in product terms: users, data owned, money movement, files/media, tenant model, external providers, and launch target.
2. Pick the closest starter. Do not invent template ids. Verify current options with `pnpm cli -- templates list --json` or local template manifests when in the repo.
3. Pick modules by owned business capability, not by technology name. Read `references/product-surfaces.md` for starter defaults, module groups, and risk defaults.
4. Separate initial scaffold modules from follow-up `add --plan` work. Provider, payment, email, webhook, auth, tenant, and production deploy work should be approval-gated.
5. Return a plan with command, starter, modules, risks, first local checks, and follow-up phases.

## Output Contract

Respond with:

- Recommended starter and why.
- Create command using the user's package manager when obvious.
- Initial module set and deferred modules.
- Approval-gated risks.
- First local verification commands.
- Questions only when the plan would otherwise risk the wrong data model, tenant model, or provider choice.

Prefer this command shape:

```bash
pnpm create microservices-app@latest <app-name> --template <template-id>
```

For npm flags:

```bash
npm create microservices-app@latest <app-name> -- --template <template-id>
```

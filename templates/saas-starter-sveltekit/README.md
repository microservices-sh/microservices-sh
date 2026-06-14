# SaaS Starter SvelteKit Template

Status: `ready`

A multi-tenant B2B SaaS starter for Cloudflare SvelteKit. A user signs up, creates
or joins an organization, and works inside an org-scoped app with team management
and subscription billing. A super-admin area spans every tenant.

## Modules

- auth
- org-team-rbac
- billing-subscriptions
- admin-shell
- audit-log

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Marketing landing |
| `/login`, `/signup` | Demo email session; signup creates a user + first org |
| `/app` | Org dashboard (member count, subscription status) + org switcher |
| `/app/team` | Members list, invitations, role changes (RBAC-gated) |
| `/app/team/accept` | Accept a single-use, expiring invitation |
| `/app/billing` | Plans, current subscription, start/change plan |
| `/app/settings` | Org details, your permissions, recent audit activity |
| `/admin`, `/admin/[resource]` | Super-admin over orgs/members via admin-shell |

`/app/*` is gated by org membership through `authorize` / `resolvePermissions`.

## Architecture

SvelteKit routes are thin adapters. Domain logic lives in the modules' detached
use cases (`createOrganization`, `inviteMember`, `startSubscription`, …). The
template owns the app shell, routes, layout, and composition glue only.

Stores resolve to D1 adapters in production and in-memory adapters locally, so the
app runs out of the box for development.

## Verification

```bash
pnpm check:spec
pnpm microservices check --json
```

## Theming

The design system is token-driven (Tailwind v4, CSS-first) in `src/app.css`. Change
`--color-accent` to rebrand. See `THEMING.md`.

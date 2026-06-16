# microservices.sh Product Surfaces

Use this as a compact routing map. Verify against local manifests before committing to a plan.

## Starters

| Starter | Use For | Avoid When |
| --- | --- | --- |
| `saas-starter-sveltekit` | Multi-tenant B2B SaaS, org/team/RBAC, subscriptions, admin, audit | Simple public booking or static marketing only |
| `booking-sveltekit` | Appointments, service businesses, booking admin, customer scheduling | Multi-tenant SaaS with teams/subscriptions as the core |
| `client-portal-sveltekit` | Customer portal, invoices, private files, account area | Public scheduling-first apps |
| `company-landing-astro` | Static marketing/company site, content-driven pages | Backend modules, auth, app workflows |
| `booking-business` | Hono/Worker API baseline, lower-level SDK/contract testing | Full SvelteKit UI needed immediately |

## Module Groups

- Identity and trust: `auth`, `identity`, `gateway`, `audit-log`.
- Tenant/admin foundation: `org-team-rbac`, `admin-shell`.
- Business data: `customer`, `booking`, `invoice`, `forms-intake`.
- Money: `payment`, `billing-subscriptions`.
- Communications/events: `email`, `notifications-inapp`, `webhook-delivery`, `jobs-workflows`.
- Files/media/AI: `file-media`, `image-generation`.
- Scheduling/provider ops: `calendar-google`, `ads-manager`.

## Risk Defaults

- High risk: auth, identity, gateway, RBAC, billing, payment, invoice money mutations, jobs with side effects, webhooks, provider OAuth/secrets, production deploy.
- Medium risk: customer PII fields, booking behavior, audit exports/redaction, files/media, notifications, image generation, admin CRUD.
- Low risk: static content, local-only UI copy, docs, theme tokens, non-sensitive layout.

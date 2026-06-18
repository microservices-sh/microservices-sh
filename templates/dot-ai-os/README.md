# DOT AI OS Template

Status: `draft`

DOT AI OS is an agent-native operator workspace for Cloudflare SvelteKit. It
adapts the Jimmy Dashboard OS "Clear Workbench" shape into the microservices.sh
stack: one workspace organization, role-based team access, audit logging, file
storage, contacts, work packets, support inbox, task board, focus planning,
calendar context, daily review, knowledge capture, content pipeline, and visible
AI-team routing.

The sidebar is derived from `microservices.lock.json`, so module-backed surfaces
appear from the installed module set instead of being hardcoded in the layout.

## Modules

Wired: auth, identity, org-team-rbac, admin-shell, audit-log, customer, invoice,
support-ticket, file-media, jobs-workflows, notifications-inapp.

Optional extension slots: calendar-google, email, webhook-delivery, ingestion,
task/content persistence, and future AI-provider modules.

## Upstream Adaptation

The upstream `jimmylau-DOTAI/jimmy-dashboard-OS` repo currently uses Vite,
React, Express, SQLite, Railway/Vercel artifacts, and Supabase/Postgres export
support. This template ports the product workflow, not that runtime coupling.

Carried over as template-owned starter surfaces:

- task list/board contract
- focus plan / today's schedule
- calendar feed/sync shape
- daily unlock/review loop
- knowledge capture pipeline
- content production pipeline
- AI team / digital worker roster

Provider calls, Google Calendar OAuth/write-back, Hermes ingestion, AI rewrites,
Obsidian export, and durable task/content/knowledge storage require explicit
module contracts or documented template-owned tables before production use.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Redirects to `/app` when signed in, otherwise `/login` |
| `/login` | Demo email session |
| `/signup` | First workspace setup: creates the org and owner |
| `/app` | DOT AI OS workbench |
| `/app/tasks` | Task board and AI intake starter surface |
| `/app/focus` | Focus-plan starter surface |
| `/app/calendar` | Calendar context and feed/sync starter surface |
| `/app/review` | Daily-review starter surface |
| `/app/knowledge` | Knowledge-log starter surface |
| `/app/content` | Content pipeline starter surface |
| `/app/ai-team` | Visible digital-worker roster and routing rules |
| `/app/customers` | Contacts, backed by the customer module |
| `/app/invoices` | Work packets, backed by the invoice module |
| `/app/support` | Support inbox, backed by support-ticket |
| `/app/files` | Stored files, backed by file-media |
| `/app/team` | Members, invitations, and role changes |
| `/app/settings` | Workspace details, permissions, and audit activity |
| `/admin`, `/admin/[resource]` | Super-admin CRUD via admin-shell |

`/app/*` is gated by workspace membership through `authorize` /
`resolvePermissions`.

## Architecture

SvelteKit routes are thin adapters. Domain logic lives in module use cases such
as `createOrganization`, `upsertCustomer`, `createInvoice`, `listFiles`, and
`recordEvent`. The template owns the app shell, routes, layout, UI composition,
`src/lib/os-data.ts`, and DOT AI OS-specific workflow surfaces.

Stores resolve to D1/R2 adapters in production and in-memory adapters locally, so
the app runs out of the box for development.

## Verification

```bash
pnpm build
pnpm check:spec
```

## Theming

The design system is token-driven in `src/app.css`. Change `--color-accent` and
the values in `microservices.config.json` to rebrand.

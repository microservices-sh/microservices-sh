# Detailed MVP Execution Plan

Generated: 2026-06-13

## MVP Thesis
The MVP should prove one thing:

> A developer or agency can use their own AI agent to compose a real booking business app from verified Hono/Cloudflare modules, customize it safely, and deploy a preview without setting up Cloudflare.

Do not try to prove every future platform idea. The MVP is not a marketplace, full SaaS builder, broad connector platform, or no-code app builder.

## Primary ICP
Build for:

> AI-heavy dev agencies, fractional CTOs, consultants, and technical founders who repeatedly build custom business apps with Claude, Codex, Cursor, or similar agents.

The first buyer is likely an agency/fractional CTO because they feel repeat-work pain and can justify paying if the product saves delivery time.

## MVP Definition
### MVP v0: Validation Shell
Goal: validate demand before heavy runtime work.

Must include:

- landing page
- waitlist
- paid pilot form
- 90-second demo or clickable walkthrough
- module catalog mock
- sample agent transcript
- pricing hypothesis
- discovery call booking

Exit gate:

- 15 qualified calls or 100 qualified waitlist signups
- 3 paid pilot commitments or credible agency commitments

### MVP v1: Agent-To-Local App
Goal: prove the module and agent workflow before managed deployment complexity.

Must include:

- Hono/TypeScript generated app
- booking business template
- create package or equivalent create command
- local CLI flow
- hosted or local MCP parity plan, but not required for first local activation
- internal TypeScript SDK
- module metadata
- generated repo output
- local test suite
- manual Cloudflare deploy instructions

Exit gate:

- 5 external users generate a working local booking app
- create command and CLI generate/inspect/check a working app
- generated app passes tests
- users need fewer than 2 manual engineering interventions on average

### MVP v2: Managed Preview Deploy
Goal: prove the paid promise: deploy without user Cloudflare setup.

Must include:

- control plane Worker
- MCP Worker
- per-project preview deploy
- generated app Worker
- per-project D1
- preview URL
- logs/status
- basic usage limits
- rollback or redeploy

Exit gate:

- user deploys preview without touching Cloudflare
- deploy failures are agent-readable
- platform can disable abusive projects
- internal cost per preview is visible
- 3 pilots say they would use it for paid work

### MVP v3: Paid Beta
Goal: prove willingness to pay.

Must include:

- Stripe billing
- simple plan limits
- project list
- usage page
- agency workspace basics
- support workflow
- onboarding emails
- public docs

Exit gate:

- 10 paying customers
- 5 active deployed apps
- 2 agencies use it for client work
- 40 percent or higher weekly active use among paid customers

## What To Build First
Build in this order:

1. Landing page and paid pilot funnel.
2. Monorepo scaffold.
3. Internal SDK and shared schemas.
4. Module contract and registry.
5. Create package or equivalent `pnpm create microservices-app` command.
6. Project CLI with `--json`.
7. Booking template generated locally.
8. CLI docs/add/check flow.
9. MCP server exposing the same operations through the SDK.
10. Managed preview deployment.
11. Billing and plan limits.

Do not build custom domains, BYO Cloudflare, multiple templates, connector marketplace, dashboard-heavy admin UI, or public SDK before the MVP gates pass.

## Product Surfaces
### 1. Landing Page
Purpose:

- explain the product
- collect waitlist leads
- book discovery calls
- validate pricing and ICP resonance

Required sections:

- hero with "Build production app foundations with your AI agent"
- problem section
- module grid/honeycomb visual
- how it works
- agency-specific value
- trust/control section
- pricing teaser
- final CTA

Use `14-landing-page-brand-brief.md` as the design brief.

### 2. Minimal Admin UI
Purpose:

- account/profile
- billing
- API/MCP keys
- project list
- connected accounts
- deployment status
- usage/limits
- logs link
- docs/setup links

Do not build visual app editing in the MVP.

### 3. CLI
Purpose:

- primary project management surface after the create command
- universal fallback for agents
- CI-friendly control path
- local generation/debugging

Required commands:

```bash
pnpm create microservices-app booking-demo --template booking-business
microservices templates list --json
microservices templates inspect booking-business --json
microservices modules list --json
microservices modules inspect booking --json
microservices docs booking
microservices add payment-stripe --plan --json
microservices secrets status --json
microservices check --json
microservices dev
microservices deploy preview --json
microservices deploy status --json
microservices logs --json
```

### 4. MCP Server
Purpose:

- agent-native parity surface after create/CLI works
- expose stable tools
- return structured responses
- make failures agent-actionable

Required tools:

- `list_templates`
- `inspect_template`
- `list_modules`
- `inspect_module`
- `compose_app`
- `validate_config`
- `generate_project`
- `run_checks`
- `deploy_preview`
- `get_deployment_status`
- `get_logs`

Production tools can exist behind explicit confirmation:

- `promote_production`
- `rollback_deployment`

### 5. Generated App
Purpose:

- prove the output is real and inspectable
- show that modules compose into working business logic

Runtime:

- TypeScript
- Hono/OpenAPIHono
- Cloudflare Workers
- D1
- KV
- Queues for async jobs
- R2 only if file assets are enabled

## Technical Architecture
### Monorepo Shape
```text
apps/
  landing/
  control-plane/
  mcp/
  background/
packages/
  sdk-internal/
  runtime/
  module-contract/
  db/
  modules/
    auth/
    organization/
    customer/
    service-catalog/
    booking/
    payment/
    email/
    admin/
    audit-log/
  templates/
    booking-business/
generated/
  examples/
```

### Workers
Control plane Worker:

- users
- projects
- module registry
- template registry
- deployments
- usage
- billing hooks
- API keys

MCP Worker:

- `/mcp`
- tool execution
- tool auth/scopes
- agent-readable errors

Background Worker:

- queues
- email jobs
- payment reconciliation
- audit export
- deploy checks

Generated app Worker:

- composed Hono module routers
- app API
- preview app runtime

### Data
Control plane D1:

- users
- teams
- API keys
- projects
- project environments
- module versions
- deployments
- usage records
- billing state

Per-project D1:

- organizations
- users
- customers
- services
- bookings
- payment records
- email messages
- audit logs

KV:

- config cache
- rate limits
- short-lived tokens
- deploy status cache

R2:

- generated project archives
- optional app assets
- export bundles

Queues:

- email send
- webhook handling
- deployment jobs
- audit export
- payment reconciliation

Durable Objects:

- defer unless required for booking slot locks or strict coordination
- use only where D1 transactions and constraints are insufficient

## MVP Modules
### Auth
Must support:

- email/password or magic-link style auth
- session/JWT handling
- roles: owner, admin, staff, customer
- protected route middleware
- password reset or OTP later if needed

Defer:

- SSO
- passkeys
- complex enterprise RBAC

### Organization/Tenant
Must support:

- one business/workspace
- business profile
- timezone
- currency
- branding basics
- business settings

Defer:

- multi-brand hierarchy
- enterprise org trees

### Customer
Must support:

- customer create/read/update
- email/phone fields
- notes/tags
- booking history relation
- custom fields config

Defer:

- advanced segmentation
- duplicate merge UI

### Service Catalog
Must support:

- services/classes
- duration
- price/deposit
- active/inactive
- capacity
- staff optionality

Defer:

- complex packages
- memberships
- inventory

### Booking
Must support:

- create booking
- reschedule
- cancel
- confirm
- availability calculation
- capacity rules
- cancellation window
- deposit-required flag
- customer and admin views

Required hooks:

- `beforeBookingCreate`
- `calculateAvailability`
- `calculateDeposit`
- `afterBookingConfirmed`

Defer:

- recurring bookings
- waitlists
- calendar sync
- multi-location complexity

### Payment
Must support:

- Stripe test mode
- payment intent or checkout session
- deposit payment
- payment status webhook
- refund marker or manual refund link

Defer:

- subscriptions
- marketplace payments
- multi-provider payments

### Email
Must support:

- booking confirmation
- cancellation email
- payment receipt link
- admin notification
- template variables
- provider abstraction for Resend/Postmark

Defer:

- marketing campaigns
- complex sequences
- inbox sync

### Admin
Must support:

- basic admin routes/views for services, bookings, customers, settings
- module-generated API/admin shell
- enough UI to inspect the app

Defer:

- rich analytics
- drag-and-drop UI builder
- full CRM dashboard

### Audit Log
Must support:

- record successful mutations
- actor, action, resource, resourceId
- requestId
- before/after fields where available
- IP/user-agent metadata

Defer:

- immutable ledger guarantees
- external SIEM export
- advanced retention policies

## Module Package Requirements
Each module must include:

- `module.json`
- `openapi.json`
- `README.agent.md`
- LLM-accessible Markdown docs
- standard `src/index.ts` entrypoint
- Hono route exports
- route mount metadata
- payload and response schemas
- D1 schema fragment
- migration
- seed data
- config schema
- hook definitions
- permissions
- emitted/consumed events
- tests
- failure modes
- upgrade notes

A module is not "verified" unless it compiles, tests pass, schema is versioned, permissions are documented, hooks are typed, and the generated app deploys.

The module documentation and package structure standards are now tracked in `19-module-docs-source-and-permissions.md`, `docs/modules/module-spec-standard.md`, and `docs/modules/module-package-structure.md`.

For MVP, `payment-stripe` should be treated as the first full provider module, not a thin connector. It must include products/prices, checkout, payment links, webhooks, refunds, database records, idempotency, tests, secrets, approval gates, and event hooks.

## Agent Workflow
Happy path:

1. User or agent runs `pnpm create microservices-app booking-demo --template booking-business`.
2. User opens the generated project in Claude/Codex/Cursor.
3. Agent reads `README.agent.md`, `docs/llms.txt`, and `microservices.lock.json`.
4. Agent runs `microservices modules list --json`.
5. Agent runs `microservices docs booking`.
6. Agent edits config and hook files.
7. Agent runs `microservices check --json`.
8. Agent optionally runs `microservices add payment-stripe --plan --json`.
9. Agent explains required secrets/resources/permissions and asks for approval.
10. User signs in only when managed preview deploy is needed.
11. Agent runs `microservices deploy preview --json`.
12. User reviews preview.
13. User requests changes.
14. Agent updates config/hooks and redeploys preview.
15. Production promotion requires explicit confirmation.

## Generated Project Structure
```text
app/
  src/
    index.ts
    runtime/
      env.ts
      middleware/
      hooks/
    modules/
      auth/
      organization/
      customer/
      service-catalog/
      booking/
      payment/
      email/
      admin/
      audit-log/
    config/
      app.config.ts
      booking.config.ts
      email.config.ts
    tests/
  migrations/
  seeds/
  wrangler.jsonc
  package.json
  microservices.lock.json
  README.md
  README.agent.md
```

Source ownership default:

- generated source belongs in a user-owned repo
- module installs and updates should happen through branch/PR or patch workflow
- managed preview deploy can run from generated artifacts
- production deploy requires explicit approval

Managed Cloudflare default:

- generated app Workers deploy into the `microservices-sh` Workers for Platforms dispatch namespace
- environment-specific namespaces are a later scaling option, not the MVP default

## Customization Model
Level 1: config

- branding
- business name
- service definitions
- booking rules
- deposit rules
- cancellation windows
- email templates
- custom customer fields

Level 2: typed hooks

- availability logic
- deposit logic
- validation logic
- post-confirmation action
- email rendering

Level 3: fork/export

- user owns the code
- upgrades become manual or agent-assisted
- platform support is limited

## Validation Plan
### Discovery Tests
Run before building v2 managed deploy:

- 30 customer discovery calls
- 10 agencies/fractional CTOs minimum
- 5 observed agent build sessions
- direct paid pilot ask

Pass:

- 3 paid pilot commitments
- repeated pain around auth/payments/email/deploy
- at least 5 users prefer verified modules over blank-agent generation

### Prototype Tests
Run with MVP v1:

- give users CLI/create quickstart docs
- ask them to generate a booking app
- observe failure points
- measure interventions

Pass:

- median setup under 10 minutes
- local dev server starts from the generated project
- generated app under 60 minutes
- fewer than 2 manual interventions
- users understand generated code layout

### Paid Pilot Tests
Run with MVP v2/v3:

- charge for managed preview or paid beta
- ask agency to use it for a real or near-real client app
- measure repeat usage

Pass:

- 10 paying customers
- 5 active deployed apps
- 2 agency client-work uses

## Analytics And Metrics
Landing page:

- visitor source
- waitlist signup
- paid pilot click
- discovery call booked
- pricing interest click

Agent workflow:

- create command completed
- local dev server started
- first project CLI command
- CLI login completed for managed preview
- first `list_templates`
- first `compose_app`
- first `generate_project`
- first `run_checks`
- first `deploy_preview`
- deploy failure reason
- time from signup to preview

Business:

- qualified calls
- paid pilot commitments
- activation rate
- cost per preview
- support interventions per project
- paid conversion

## MVP Acceptance Criteria
The MVP is real when:

- a new user can run the create command and start local dev in under 10 minutes
- an agent can inspect modules and compose the booking app
- the generated app has working auth, customers, services, bookings, payment test mode, email test mode, admin, and audit log
- at least one typed hook changes real app behavior
- tests produce agent-readable failures
- preview deploy works without the user touching Cloudflare
- logs/status are visible enough to debug
- usage limits prevent runaway cost
- user can export or inspect generated source
- MCP exposes the same workflow after the create/CLI path is proven

## Non-Goals
Do not build in MVP:

- many templates
- public module marketplace
- visual app builder
- complex dashboard
- BYO Cloudflare
- custom domain automation
- public SDK
- Dockerized MCP before basic create/CLI/MCP works
- broad connector store
- Google Calendar
- WhatsApp/SMS
- QuickBooks/Xero
- Shopify
- SSO
- advanced compliance claims

## First 14 Days
1. Finalize landing page copy and design brief.
2. Publish waitlist and paid pilot form.
3. Create monorepo scaffold.
4. Define module contract JSON schema.
5. Define internal SDK method signatures.
6. Define create package and project CLI command shape.
7. Draft MCP tool schemas for parity after create/CLI.
8. Build static module registry with 3 modules: Auth, Customer, Booking.
9. Build generated app skeleton.
10. Write first observed demo script.

## First 30 Days
1. Complete landing page + analytics.
2. Recruit 30 prospects.
3. Complete at least 10 interviews.
4. Build local Hono generated booking app.
5. Implement create command and CLI `templates`, `modules`, `docs`, `add --plan`, `check`.
6. Implement MCP tools for the same operations after CLI behavior stabilizes.
7. Add Auth, Customer, Service Catalog, Booking, Email, Payment test mode, Admin, Audit Log.
8. Run 5 external generation tests.
9. Ask for paid pilot commitments.
10. Decide whether to proceed to managed preview deploy.

## Recommendation
Start the MVP, but do not start with the full managed Cloudflare platform.

Start with a validation shell and local generated app first. Then add managed preview deploy only after users prove that they want the module-based agent workflow.

The MVP should feel narrow:

> booking business app, verified Hono modules, MCP/CLI agent workflow, managed Cloudflare preview.

Updated sharper wedge:

> create command, booking business app, verified Hono modules, CLI-first agent workflow, managed Cloudflare preview.

That is enough to validate the core business without overbuilding the future platform.

# MVP Scope

## MVP Promise
The MVP should prove one promise:

> A user can use their own AI coding agent to create and deploy a working production-style business app from verified modules, without setting up Cloudflare.

## First Template
Build one vertical template:

> Booking business system

This template can serve service businesses, classes, clinics, consultants, repair shops, tutors, studios, and SaaS-like scheduling products. It is concrete but reusable.

## First User Story
```text
As an AI-heavy developer or agency,
I want to ask Claude/Codex/Cursor to create a booking app for a specific business,
so that I can customize requirements and deploy a working app without rebuilding auth, booking, payment, and email infrastructure.
```

## MVP Modules
Required:

- Auth
- Organization/Tenant
- User/Profile
- Customer
- Service Catalog
- Booking
- Payment
- Email
- Admin
- Audit Log

Optional after the first working loop:

- File Upload
- Invoice
- Google Calendar
- Staff Scheduling
- Notifications

## MVP Connectors
Required:

- Stripe for payments
- Resend or Postmark for transactional email

Defer:

- Google Calendar
- QuickBooks/Xero
- Shopify
- WhatsApp/SMS
- CRM integrations

## MVP User Interfaces
Primary interface:

- create package
- project CLI wrapper
- MCP server after the CLI/create flow is credible
- agent-readable docs
- generated GitHub repo or downloadable project

Minimal web UI:

- login/profile
- billing
- API/MCP key
- connected accounts
- project list
- deployment status
- usage and limits
- logs link
- setup docs

Do not build:

- visual app builder
- drag-and-drop workflow editor
- module marketplace UI
- rich analytics dashboard
- full CMS

## MVP Customization Levels
Level 1: Config customization

- business name
- branding
- service types
- staff count
- booking durations
- cancellation rules
- deposit rules
- email templates
- custom customer fields

Level 2: Safe extension hooks

- `beforeBookingCreate`
- `afterBookingConfirmed`
- `calculateAvailability`
- `calculateDeposit`
- `validateCustomer`
- `renderEmailTemplate`

Level 3: Export/fork

- generate full repo
- user owns code
- upgrades become manual or assisted

## MVP Flow
1. User or agent runs `pnpm create microservices-app booking-demo --template booking-business`.
2. User opens the generated project in Claude/Codex/Cursor.
3. Agent reads `README.agent.md`, `docs/llms.txt`, and `microservices.lock.json`.
4. Agent runs `microservices modules list --json`.
5. Agent runs `microservices docs booking`.
6. Agent customizes config and hooks.
7. Agent runs `microservices check --json`.
8. Agent optionally runs `microservices add payment-stripe --plan --json`.
9. Agent explains required secrets/resources/permissions and asks for approval.
10. User signs in only when managed preview deploy is needed.
11. Agent runs `microservices deploy preview --json`.
12. User reviews preview.
13. Production promotion requires explicit approval.

## MVP Acceptance Criteria
- A new user can run the create command and start local dev in under 10 minutes.
- A booking app can be generated in under 15 minutes.
- A preview can be deployed without the user touching Cloudflare.
- Tests run and produce agent-readable failures.
- At least one customization hook changes real behavior.
- Stripe and email can run in test mode.
- Usage limits prevent runaway cost.
- MCP can expose the same workflow after the create/CLI path is working.

## Explicit Non-Goals For MVP
- Multiple templates.
- Broad connector store.
- Full BYO Cloudflare.
- Custom domain automation.
- Marketplace payments to third-party module creators.
- Production-grade compliance claims.
- Full multi-region data residency controls.
- Complex role editor.
- White-label agency portal.

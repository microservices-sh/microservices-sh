# Development Roadmap

## Operating Workflow
Use a strict gate-based workflow:

1. Review.
2. Scope.
3. Build smallest proof.
4. Test with real users.
5. Decide: continue, narrow, pivot, or stop.

Do not enter the next phase until the gate is met.

## Phase 0: Product Shell
Duration: 1 to 2 weeks

Build:

- landing page
- waitlist
- paid pilot form
- docs skeleton
- sample prompts
- module contract draft
- clickable or recorded demo

Engineering:

- static site
- analytics
- form capture
- CRM or spreadsheet for leads

Gate:

- 100 qualified waitlist signups or 15 qualified calls
- 3 paid pilot commitments or strong agency interest

## Phase 1: CLI-First App Creator Prototype
Duration: 2 to 4 weeks

Build:

- Hono Workers monorepo scaffold
- shared runtime package for `HonoEnv`, response helpers, request IDs, DB middleware, error handling, audit middleware, and hook runner
- internal TypeScript SDK for shared create/CLI/MCP/API operations
- `create-microservices-app` package or equivalent create command
- project `microservices` CLI with `--json` output
- module metadata format
- template metadata format
- `list_templates`
- `inspect_module`
- `docs <module>`
- `add <module> --plan`
- `compose_app`
- `generate_project`
- `run_checks`

Output:

- generated repo
- generated Hono app Worker
- working create command and CLI path for the generation flow
- local tests
- deploy instructions, even if deploy is manual first

Gate:

- 5 external users run the create command and start local dev from docs only
- agent can generate a working local Hono booking app
- CLI can inspect docs/modules and run checks from inside the generated project
- 5 external users complete generation with limited help
- generated app passes tests

## Phase 2: Booking Template
Duration: 4 to 6 weeks

Build:

- Auth module
- Organization/Tenant module
- Customer module
- Service Catalog module
- Booking module
- Payment module
- Email module
- Admin module
- Audit Log module

Deliver:

- one end-to-end booking app
- composed Hono module routers
- generated OpenAPI document
- Stripe test mode
- email test mode
- seed data
- tests
- extension hook examples
- agent customization guide

Gate:

- 10 pilot users customize variants
- median time to working app under 60 minutes
- fewer than 2 manual engineering interventions per pilot
- 3 users say they would use it for real work

## Phase 3: Managed Cloudflare Preview Deploys
Duration: 4 to 8 weeks

Build:

- Hono control plane Worker
- dispatch namespace
- user Worker deployment flow
- per-project D1 provisioning
- per-project secrets/config
- preview URLs
- logs view/link
- usage limits
- rollback

Optional after the main deploy flow works:

- dedicated Hono MCP Worker exposing the same SDK methods
- local stdio MCP package
- Dockerized MCP package for deterministic install and directory submissions

Gate:

- user deploys preview without touching Cloudflare
- failed deploys return agent-readable errors
- platform can disable or limit abusive projects
- internal cost per preview is visible

## Phase 4: Paid Beta
Duration: 6 to 10 weeks

Build:

- billing through Stripe
- plan limits
- project usage page
- agency workspace basics
- support workflow
- onboarding emails
- public docs

Gate:

- 10 paying customers
- 5 active deployed apps
- 2 agencies use it on client work
- 40%+ weekly active use among paid customers

## Phase 5: Expansion
Start only after Phase 4 gate.

Candidate templates:

1. Invoice system
2. Customer portal
3. Order management
4. Internal admin tool
5. SaaS starter

Expansion rule:

- Add modules only when they support at least two templates.
- Add connectors only when they unblock a paid workflow.
- Add dashboard UI only when agent workflow needs account-level visibility.

## First 30 Days Checklist
- [ ] Write public positioning.
- [ ] Publish waitlist page.
- [ ] Draft create package and project CLI command list.
- [ ] Draft module metadata schema.
- [ ] Draft booking template spec.
- [ ] Recruit 30 interview targets.
- [ ] Complete 10 interviews.
- [ ] Build first generated repo manually.
- [ ] Package the first create command.
- [ ] Record 3 demo workflows.
- [ ] Ask for paid pilot commitments.

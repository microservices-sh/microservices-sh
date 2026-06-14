# Product Validation Plan

## Validation Goal
Before investing in a full platform, prove that users will pay for:

> verified agent-ready modules plus managed Cloudflare deployment for production apps.

## Current Research Status
Secondary research supports the category and pricing frame, but does not yet validate willingness to pay for our exact product.

See `11-market-research-verification.md` for the current evidence map. The strongest validated signals so far are:

- AI coding tool adoption is high.
- Trust in AI-generated output is weak.
- Agent-native infrastructure and connector products are emerging.
- Boilerplates prove willingness to pay for saved setup time.
- Raw Cloudflare is cheap, so the product must be priced as agent-native app infrastructure rather than hosting.

See `12-assumption-validation-results.md` for the assumption-by-assumption verdict. The important conclusion is:

> Proceed with validation work and a concierge prototype, but do not build the full managed runtime until paid-pilot gates are met.

The unvalidated assumptions remain:

- agencies will pay monthly for microservices.sh;
- managed Cloudflare is preferred over BYO Cloudflare;
- booking is the best first template;
- $49/$99/$299 pricing clears willingness-to-pay;
- developers will trust our module abstraction after inspecting generated code.

## Core Assumptions
| Assumption | Validation Method | Pass Signal |
|------------|-------------------|-------------|
| Users already use AI agents to build apps | Interviews | 20 of 30 targets have used agents for real app work |
| Agent-built apps fail in repeatable production areas | Interviews and build tests | 10+ repeated mentions across auth, payments, emails, data, deploys |
| Managed Cloudflare removes meaningful friction | Prototype walkthrough | 50%+ prefer managed mode over BYO setup |
| Users trust inspectable modules | Prototype and repo review | 60%+ say they would use modules if code/tests are visible |
| Users will pay | Paid pilot ask | 3+ prepaid or signed pilot commitments before platform build-out |
| Users see this as more than hosting | Pricing conversation | 60%+ compare it to saved development time, modules, or boilerplates rather than only Cloudflare/Vercel hosting |

## Customer Segments To Test
Primary:

- dev agencies using AI tools
- AI-heavy solo developers
- technical founders
- fractional CTOs
- internal-tools consultants

Secondary:

- Cloudflare Workers developers
- SaaS boilerplate buyers
- no-code/low-code escapees who now use agents

## Validation Sequence
### Step 1: Fake-Door Landing Page
Build a landing page with:

- clear positioning
- sample agent prompt
- short demo video or animated walkthrough
- waitlist
- paid pilot CTA
- agency CTA

Test three messages:

1. "Build production apps with your AI agent using verified Cloudflare-native modules."
2. "Deploy AI-built apps to managed Cloudflare without setup."
3. "Reusable business-app modules for Claude, Codex, and Cursor."
4. "Cloudflare gives primitives. microservices.sh gives your agent verified app modules and managed deploys."

Pass gate:

- 100 qualified waitlist signups
- 8%+ visitor-to-signup conversion
- 3%+ visitor-to-call conversion

### Step 1.5: CLI-First Quickstart Readiness
Before submitting to MCP directories or asking strangers to configure MCP, prove the create-app path.

Build:

- `/docs/quickstart`
- `/docs/create-app`
- `/docs/cli`
- `/docs/modules`
- `/docs/security`
- public create command: `npm create microservices-app@latest` / `pnpm create microservices-app`
- project CLI commands: `modules list`, `docs`, `add --plan`, `check`, `deploy preview`
- generated `README.agent.md`, `docs/llms.txt`, and `microservices.lock.json`
- demo video or agent transcript that starts from the create command

Then prepare MCP directory assets:

- `/docs/mcp-setup`
- public MCP server endpoint or installable local MCP package
- server manifest / registry metadata
- example Claude/Cursor MCP configs and CLI/API fallback instructions for other agents
- minimum MCP tool surface matching the create/CLI workflow

Submit only after this gate is met. See `13-mcp-directory-distribution.md`.

Pass gate:

- one external user completes the create-app flow from docs only
- one external user starts the generated app locally
- one external user successfully runs `microservices modules list --json`
- setup docs produce no more than one support intervention

### Step 2: 30 Customer Calls
Run calls using `09-interview-script.md`.

Pass gate:

- 15+ qualified calls completed
- 10+ mention repeated production pain
- 5+ agree to test the prototype
- 3+ agree to pay or prepay

Required call mix:

- 10 dev agencies or agency-like consultants
- 8 technical founders or solo builders
- 6 fractional CTOs / internal-tools consultants
- 6 Cloudflare/Workers-aware developers

Template preference test:

Ask each qualified respondent to rank:

- booking system
- invoice system
- customer portal
- order management
- SaaS starter

Pass gate:

- booking wins or ties among agency/fractional CTO respondents; otherwise switch the first template before implementation.

### Step 3: Concierge Prototype
Do not fully automate yet.

Offer:

- agent-readable docs
- a manually maintained module registry
- a generated booking repo
- a CLI-first generated booking workflow
- assisted deploy
- one customization hook

Pass gate:

- 5 users create a working app
- 3 users deploy a preview
- 2 users use it for a serious project/client

### Step 4: Paid Beta
Charge early.

Pass gate:

- 10 paid beta customers
- 5 active deployed apps
- 2 agencies using it for client work
- 40%+ weekly active usage among paid users

### Step 5: Pricing Test
Test four price anchors:

- Free local generation, no managed production deploy.
- Builder at $49/month for one managed app.
- Pro at $99/month for three managed apps.
- Agency at $299/month for 10 managed apps and client workspaces.

Pass gate:

- 3+ users commit to paid pilots.
- 2+ agencies agree that $299/month is plausible if it saves delivery time.
- fewer than half of qualified users frame pricing only as "more expensive Cloudflare."

### Step 6: Trust Test
Show the generated repo structure, module contract, hook contract, and lock file.

Pass gate:

- 60%+ say they would use it if code and tests are visible.
- fewer than 25% reject the module abstraction outright.
- the top objections can be addressed through export, hooks, tests, or docs.

## What To Measure In Build Tests
- time to first create command
- time to local dev server
- time to first project CLI command
- traffic and signups from MCP directories after MCP is credible
- time to generated app
- time to preview deploy
- number of agent tool calls
- number of failed checks
- number of human interventions
- which customization requests fail
- whether generated code remains understandable
- whether users trust the output

## Kill Or Pivot Criteria
Kill or pivot the current wedge if:

- fewer than 3 users will pay after 30 qualified conversations
- users want static boilerplates but not managed deployment
- users want no-code UI more than agent workflow
- users do not trust external modules even with source/tests
- Cloudflare runtime limits block the first template
- users only value the product as cheap hosting and reject the module/agent workflow value

## Strongest Validation Signal
The strongest signal is not waitlist size. It is:

> An agency uses microservices.sh to deliver a paid client app faster than their normal workflow, then asks for another template.

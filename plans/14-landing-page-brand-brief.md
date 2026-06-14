# Landing Page Brand And Conversion Brief

Generated: 2026-06-13

## Purpose
This brief is the handoff document for designing and building the first microservices.sh landing page.

The landing page is not a brand showcase. It is a validation asset. Its job is to help the right visitor quickly understand the product, trust the technical direction, and take one conversion action.

Primary conversion actions:

1. Join the paid beta waitlist.
2. Book a discovery call.
3. Express interest in a paid pilot.

Secondary actions:

1. Watch the module demo.
2. View module examples.
3. Read CLI/create and MCP setup notes once available.

## Core Product Context
microservices.sh lets developers use their own AI agent to compose verified Cloudflare-native modules and deploy production apps without setting up Cloudflare.

Product category:

> Agent-native application infrastructure.

Do not lead with:

- SaaS builder
- no-code builder
- generic microservices marketplace
- Cloudflare wrapper
- hosting provider
- magic app generator

SaaS is one possible output. The broader promise is production app and business-system foundations for AI-assisted development.

## Target ICP
Primary ICP:

> AI-heavy dev agencies and fractional CTOs building repeatable custom business apps with coding agents.

Why this is the best first ICP:

- They repeatedly rebuild auth, customer records, booking, payments, email, admin, audit logs, and deployment.
- They care about delivery speed, client margin, and repeatable architecture.
- They already use Claude, Codex, Cursor, or similar tools.
- They feel the pain when generated apps reach 70 percent completion and then become risky to ship.
- They are more likely to pay for time saved and risk reduced.

Secondary ICP:

> Technical founders using AI agents to build products, internal tools, customer portals, or workflow apps.

The secondary ICP is useful for waitlist volume and self-serve feedback, but the first paid pilot motion should focus on agencies, consultants, and fractional CTOs.

## Customer Pain To Lead With
Lead with production trust, not with the visual metaphor.

Core pain:

> AI agents can generate apps quickly, but the production parts are fragile, inconsistent, and expensive to debug.

Customer language to use:

- "AI gets us 70 percent there, then we spend days fixing production parts."
- "We rebuild the same client portal foundation every project."
- "I do not trust the generated auth and payment code."
- "I want code I can own, not another black box."

Problems to show:

- repeated foundation work
- fragile generated auth and payment logic
- webhook and email mistakes
- unclear migrations
- deployment friction
- lack of audit logs
- stale boilerplates
- no safe upgrade path after customization

## Brand Theme Decision
Use the user's "honey bee net" concept as a technical honeycomb network theme.

Recommended interpretation:

> Neon green honeycomb grid for agent-built systems.

The theme should communicate modularity, safe boundaries, connected services, and live deployment. It should not become cute, mascot-led, or playful.

What the metaphor means:

| Visual Element | Product Meaning |
|----------------|-----------------|
| Honeycomb cells | Verified app modules |
| Connected paths | Hooks, events, connectors, and data flow |
| Neon green activity | Agent actions, checks, deploys, live status |
| Module labels | Auth, Customer, Booking, Payment, Email, Admin, Audit |
| Larger cluster | A composed production app |
| Faint outer cells | Future modules and connectors |

Use "honeycomb network" or "module grid" internally. Avoid using "bee" language in public copy unless a future brand direction proves it converts.

## Visual Direction
Design personality:

- technical
- precise
- confident
- modern
- low-hype
- source-visible
- infrastructure-literate

Recommended visual system:

- Dark neutral base, not blue-heavy.
- Neon green as the active signal color.
- Small secondary accents such as cyan or amber only where useful for state differentiation.
- Fine-line grid, hexagonal cells, module nodes, terminal-like details.
- Motion can show an agent path activating cells in sequence.
- Visuals should feel like a live system map, not a decorative crypto/cyberpunk background.

Suggested color roles:

| Role | Example | Usage |
|------|---------|-------|
| Base background | `#070A08` or `#0B0F0C` | Page background or hero visual field |
| Main text | `#EAFBF1` | Hero and high-contrast copy |
| Muted text | `#91A89A` | Secondary copy |
| Neon green | `#38FF88` or `#00F57A` | Active paths, CTA accents, status states |
| Soft green | `#9FFFC2` | Hover states, highlights |
| Cyan accent | `#4DD8FF` | Optional secondary path or connector state |
| Amber accent | `#FFC857` | Optional warning/check state |

Important: do not make the whole page only green-on-black. The green should signal action and differentiation. The page still needs readable hierarchy, neutral surfaces, and credible technical detail.

## What To Avoid
Avoid:

- cartoon bee mascot
- bee puns
- "hive mind" positioning
- playful consumer tone
- heavy cyberpunk styling
- unreadable green text on black
- generic abstract glowing blobs
- making the honeycomb the main message
- saying "microservices marketplace"
- saying "SaaS builder" as the headline
- claiming the product is fully validated before pilots exist

The brand should feel like a serious developer infrastructure product with a memorable visual system.

## Above-The-Fold Recommendation
The first viewport should answer four questions within five seconds:

1. What is this?
2. Who is it for?
3. Why should I trust it more than random generated code?
4. What should I do next?

Recommended hero headline:

> Build production app foundations with your AI agent.

Recommended subheadline:

> Compose verified Cloudflare-native modules like Auth, Customer, Booking, Payment, Email, Admin, and Audit Log. Customize through safe hooks. Deploy without setting up Cloudflare.

Primary CTA:

> Join the paid beta

Secondary CTA:

> See module demo

Small trust line near CTA:

> Built for agencies, consultants, and technical founders using Claude, Codex, Cursor, CLI, MCP, or API workflows.

Hero visual:

- Honeycomb module graph.
- Center cells labeled with core modules.
- A highlighted path showing an agent composing modules into one deployable app.
- Small code/module metadata hints, such as `pnpm create microservices-app`, `module.json`, `hooks`, `tests`, `deploy`.
- Avoid a static decorative illustration. The visual should explain the product.

## Recommended Page Structure
### 1. Hero
Goal: immediate clarity and conversion.

Content:

- headline
- subheadline
- primary and secondary CTA
- honeycomb module graph visual
- short ICP trust line

### 2. Problem
Goal: show the visitor we understand the pain.

Section headline:

> AI can generate the app. Production is where it gets expensive.

Points:

- auth, payments, emails, and webhooks break trust
- every client project repeats the same foundation work
- boilerplates go stale after customization
- Cloudflare primitives are powerful but still require setup

### 3. Solution
Goal: introduce the product as a safer foundation, not magic generation.

Section headline:

> Verified modules your agent can inspect, compose, and customize.

Show module cards/cells:

- Auth
- Customer
- Booking
- Payment
- Email
- Admin
- Audit Log

Each cell should include one short proof point, such as "routes", "schema", "permissions", "events", "tests", or "hooks".

### 4. How It Works
Goal: reduce perceived complexity.

Three steps:

1. Start with `pnpm create microservices-app`.
2. Let your agent inspect docs, choose modules, and plan changes through the CLI or MCP.
3. Customize through config and typed hooks, then deploy to managed Cloudflare.

### 5. Why Agencies Care
Goal: speak directly to the first ICP.

Section headline:

> Stop rebuilding the same client-app foundation.

Benefits:

- reuse tested foundations across projects
- preserve margins on custom app work
- keep code inspectable and exportable
- avoid black-box no-code limitations
- use managed Cloudflare without client setup friction

### 6. Trust And Control
Goal: handle the biggest objections.

Include:

- source-visible generated code
- pinned module versions
- explicit upgrade flow
- typed hooks for customization
- audit logs
- tests and checks
- export path
- no broad hidden shell execution in public MCP tools

### 7. Pricing Teaser
Goal: anchor value without overbuilding a full pricing page.

Suggested copy:

> Public beta starts with a free local generation tier and paid managed deploy plans for serious builders and agencies.

Show early hypothesis only if needed:

- Builder: from $49/month
- Pro: from $99/month
- Agency: from $299/month

Use careful wording: "planned beta pricing" or "pricing hypothesis" until validated.

### 8. Final CTA
Goal: convert visitors who understand the offer.

Headline:

> Want your agent to build on verified foundations?

CTA:

> Join the paid beta

Secondary:

> Book a discovery call

## Copy Guardrails
Use:

- agent-native
- verified modules
- Cloudflare-native
- managed deploy
- production apps
- business systems
- safe hooks
- inspectable code
- upgradeable modules
- module graph
- module grid

Avoid:

- magic
- autonomous app factory
- no-code
- SaaS-only
- Cloudflare wrapper
- marketplace
- cheap hosting
- bee puns
- hive mind

Tone:

- direct
- technical
- specific
- pragmatic
- low hype

## Landing Page Proof Assets
The page will convert better if the design includes at least three proof artifacts, even if early.

Recommended proof assets:

1. A sample module contract screenshot.
2. A generated booking app preview.
3. A short agent transcript showing module inspection and composition.
4. A simple architecture diagram: agent -> microservices.sh -> managed Cloudflare.
5. A sample `microservices.lock.json` or `module.json` snippet.

If real customer logos or testimonials do not exist yet, do not fake social proof. Use product proof instead.

## Design Handoff Requirements
The design developer should produce:

- responsive landing page
- first viewport with clear conversion CTA
- animated or interactive honeycomb module graph if feasible
- waitlist form or call booking CTA
- module grid section
- "how it works" section
- trust/control section
- simple pricing teaser
- analytics events for CTA clicks and form submissions

Required analytics events:

- `hero_paid_beta_click`
- `hero_demo_click`
- `waitlist_submit`
- `book_call_click`
- `module_demo_click`
- `pricing_interest_click`

## Success Criteria
The landing page is good enough for validation when:

- a technical visitor can explain the product after five seconds
- the page does not read as a no-code builder or generic SaaS boilerplate
- the honeycomb visual explains module composition
- CTA is visible above the fold on desktop and mobile
- the copy names the ICP and the pain clearly
- it includes at least one concrete module example
- it includes at least one control/trust mechanism
- it can collect waitlist or discovery-call intent

Early conversion targets:

- 5 percent or higher visitor-to-waitlist conversion from targeted outreach
- 2 percent or higher visitor-to-call-booking conversion from direct agency outreach
- 10 qualified discovery calls from first 200 targeted visitors
- 3 paid pilot commitments before building the full managed runtime

## Design Summary
Use the honey bee net idea as a **neon green honeycomb module network**, not as a bee-themed brand.

The visual should make the product easier to understand:

> agents compose verified cells into a deployable Cloudflare-native business system.

The page should sell trust, speed, and control to AI-heavy agencies and technical builders. The theme should make microservices.sh memorable, but conversion depends on clear ICP language, concrete module examples, and proof that the generated foundation is safer than arbitrary agent code.

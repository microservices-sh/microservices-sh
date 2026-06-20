# Landing Page, Marketing Strategy, And Product Roadmap

Generated: 2026-06-20

## Executive Verdict
Lead with this:

> Production foundations for AI-built Cloudflare apps.

Explain the category as:

> microservices.sh System Harness is a contract-driven development environment for agent-built apps.

The product should not present itself as another AI app builder, boilerplate, MCP server, or Cloudflare hosting wrapper. The highest-value promise is the system around generated apps: source-visible modules, contracts, lockfiles, local checks, upgrade plans, approval gates, and reviewable deploy plans.

The clearest competitive frame is:

> App builders generate. microservices.sh harnesses.

## Landing Page Audit
The landing page already had the right ingredients: local-first create command, inspectable modules, source ownership, Cloudflare-native deploy story, agency use case, pricing, compare pages, quickstart, and MCP as a secondary route.

The weakness was emphasis. The copy still over-indexed on "verified modules" as the product, while the stronger product is the harness around agent-built apps.

Revised direction:

- Use `microservices.sh System Harness` in the hero eyebrow and core category language.
- Keep `verified modules` as proof, not the entire positioning.
- Say "use any builder" rather than competing head-on with Lovable, Bolt, Replit, v0, or Cursor.
- Move production risk to the front: auth, billing, tenant isolation, webhooks, audit, checks, deploy plans.
- Treat CLI and MCP as ways agents access the harness, not as the headline.
- Make quickstart the primary CTA because Hacker News and developer channels need something runnable without signup.
- Keep agency pilot as the highest-value conversion, but do not make the first screen a consultancy-only pitch.

Implemented LP changes in the landing-page repo:

- Hero now leads with "Production foundations for AI-built Cloudflare apps" and "System Harness."
- Problem section now frames "demo works, production breaks" instead of generic generated-code risk.
- Solution section now says "not another prompt-to-app builder and not a black-box backend."
- Quickstart now frames local generation as account-free harness proof.
- Agency page now positions microservices.sh as a harness for repeated client delivery.
- Pricing, compare, writing, footer, and nav copy now align with the new category.
- Navbar CTA now points to `/#quickstart` so it works from secondary pages.

## Market Read
The public market supports this angle:

- Stack Overflow 2025 shows broad AI tool adoption, but trust is the gap: 84% use or plan to use AI tools, while more developers distrust AI accuracy than trust it.
- The same survey shows high resistance to AI for deployment and monitoring. This supports a product focused on checks, review, and approval boundaries.
- Lovable and Bolt own "chat with AI to create apps/websites" and already present hosting, auth, databases, SEO, custom domains, and design-system support. Do not fight them as a smaller app builder.
- Cloudflare Agents now talks about durable agent runtimes, MCP, tools, payments, and agent harnesses. This validates the agent-system language, but it means microservices.sh should always use the branded phrase `microservices.sh System Harness`, not "Harness" alone.
- HN Show HN requires something users can try, preferably without signup. A landing page, waitlist, or abstract OS story should not be the first HN launch.

## Positioning Stack
Use this hierarchy consistently:

1. Category: `microservices.sh System Harness`.
2. One-liner: `Production foundations for AI-built Cloudflare apps.`
3. Mechanism: `contracts, lockfiles, module docs, local checks, upgrade plans, and approval-gated deploy plans`.
4. Proof: `source-visible Cloudflare-native modules for auth, payments, booking, customer records, webhooks, email, audit, and tenancy`.
5. Access surfaces: `create package, CLI, MCP, hosted control plane`.
6. Buyer outcome: `agents move faster without inventing the production trust boundary from scratch`.

Avoid:

- "AI app builder"
- "no-code"
- "Cloudflare wrapper"
- "MCP server for microservices" as the headline
- "external service integration harness"
- "autonomous deploys" before approval gates are actually end-to-end

## ICP
Primary ICP:

> AI-heavy technical founders, agencies, fractional CTOs, and Cloudflare-oriented developers building client portals, booking flows, internal tools, and SaaS MVPs where auth, tenancy, billing, audit, migrations, and deploys matter.

Why they should care:

- They already use Claude Code, Codex, Cursor, Replit, v0, Lovable, or terminal agents.
- They trust agents for speed, but not for production boundaries.
- They repeatedly rebuild the same dangerous foundation.
- They need source ownership and handoff quality.
- They can evaluate the product from a runnable CLI workflow.

Secondary ICP:

> Business operators and ops leads who want agent-governed workflows.

This is a pilot lane, not the broad public launch. Agent Center, Hermes, Ads Manager, and Marketing Research should be shown as governed-system examples only after their runtime, billing, audit, and approval gates are clear.

## Marketing Strategy
### 1. Developer Proof Lane
Goal: prove the product is real and useful to builders.

Primary CTA:

```sh
pnpm create microservices-app@latest studio-booking --template booking-sveltekit
```

Campaign claim:

> Use any coding agent. Give it contracts, checks, and approval gates for the production layer.

Channels:

- MCP directories and official MCP Registry for high-intent agent discovery.
- Hacker News Show HN only after the quickstart, video, docs, and repo are internally consistent.
- X/LinkedIn founder posts that show concrete failure prevention, not generic AI productivity.
- Cloudflare and agent-builder communities where people discuss deployment, auth, and generated-app safety.
- Docs-driven SEO pages: comparisons, migration guides, module-contract explanations, and quickstart pages.

Required assets before broad push:

- Updated video with current package/MCP version and correct duration.
- One 3-minute proof path: create app, inspect contracts, add payment plan, run checks, show approval gate.
- Public quickstart that works with no signup.
- A short "what this is not" section in docs: not app builder, not BaaS, not connector marketplace.

### 2. Agency Pilot Lane
Goal: find paying, repeat-use buyers.

Offer:

> Bring your agent. Ship a client portal or booking/customer/payment app through a governed Cloudflare foundation.

Motion:

- Direct outreach to 50 agencies, fractional CTOs, and AI-heavy dev shops.
- Ask for one concrete app they repeatedly rebuild.
- Offer concierge setup and a fixed pilot scope.
- Measure whether they would pay for repeat delivery and risk reduction, not only whether they like the idea.

Pilot CTA:

- `Apply for the agency pilot`
- `Book a 25-minute workflow teardown`

Success criteria:

- 10 serious calls.
- 3 paid pilots or written commitments.
- 2 agencies use generated code in real client work.
- Median time to local working app below 30 minutes for qualified users.

### 3. Business-Operator Pilot Lane
Goal: validate the broader "operating system with governed agents" direction without confusing the launch.

Use cases:

- ERP shell / Agent Center.
- Hermes runtime.
- Ads Manager approval plans.
- Marketing Research with cite-or-refuse behavior.

Guardrail:

Market this as a private pilot only. Do not lead the public homepage with "business OS" until runtime creation, billing gates, audit persistence, and approval cards are real.

### 4. Paid Acquisition
Do not start broad paid ads yet.

Prerequisites:

- Conversion tracking and UTMs for quickstart, npm click, MCP install, agency application, and signup.
- One proven activation metric, such as `run_checks` completed or generated app started locally.
- A working retargeting audience from organic visitors.
- A landing proof video that is version-correct.

When ready, start small:

- Retargeting only.
- $20 to $50/day for 2 weeks.
- Audience: site visitors, docs visitors, npm/package clickers, agency page visitors.
- Message: "Stop asking your agent to invent auth and billing."

## Content Pillars
1. The production gap: agents build the first 70%; auth, billing, tenancy, audit, migrations, and deploy gates break the last 30%.
2. The proof workflow: create app, inspect contracts, add-plan, run checks, preview plan.
3. Agency economics: stop rebuilding the same foundation every client engagement.
4. Source ownership: real code, Cloudflare-native, exportable, not a black box.
5. Approval boundaries: provider writes, deploys, secrets, billing, and external effects need explicit gates.
6. Comparison pages: app builders, BaaS, boilerplates, connector platforms, Cloudflare DIY.

## Product Development Roadmap
### Phase 0: Launch Readiness
Timeline: now to 1 week.

Ship:

- LP copy aligned to System Harness.
- Video updated for current package/MCP version and actual duration.
- Quickstart proof path verified on a clean machine.
- Analytics events for hero CTA, quickstart copy, npm package, MCP docs, agency pilot, and signup.
- Public docs page: `What is microservices.sh System Harness?`

Gate:

- A new user can run the quickstart without signup and understand what changed in under 10 minutes.

### Phase 1: Proof Workflow
Timeline: 1 to 3 weeks.

Ship the externally demoable loop:

1. Generate app.
2. Inspect module contracts.
3. Add or plan payment.
4. Run checks.
5. Show one failure caught or one approval gate triggered.
6. Create a preview deploy plan.

Gate:

- 5 external users complete the loop from docs only.
- At least 3 users can explain the value as "it makes my agent safer for production," not merely "it scaffolds an app."

### Phase 2: Agency Pilot Hardening
Timeline: 3 to 6 weeks.

Ship:

- One agency-ready template: client portal, booking/customer/payment app, or SaaS starter.
- Better handoff docs and module docs inside generated projects.
- Smoke tests for generated app routes and checks.
- Managed preview plan/status/log UX.
- Clear workspace/API-key setup.
- Entitlement gates for hosted actions.

Gate:

- 3 agency/fractional CTO pilots.
- 2 real client or internal apps created.
- Fewer than 2 manual engineering interventions per pilot after setup.

### Phase 3: Managed Deploy Reliability
Timeline: 6 to 10 weeks.

Ship:

- Upload adapter and binding rewrite for Workers.
- D1/KV/R2 provisioning flow with explicit approvals.
- Deployment logs, status polling, disable/cleanup path.
- Production confirmation and audit records.
- BYO Cloudflare API-token path documented before OAuth.

Gate:

- Preview deploys work without users touching Cloudflare.
- Failed deploys return agent-readable errors.
- Resource cleanup and cost caps are visible.

### Phase 4: Business-Operator Pilot
Timeline: after developer proof and agency pilots show pull.

Ship:

- Agent Center and Hermes hosted-vs-BYO docs.
- Runtime creation/status that is not just UI.
- Approval card persistence.
- Audit trace for agent actions.
- Marketing Research README and stable cite-or-refuse flow.
- Ads Manager write boundaries with provider action gates.

Gate:

- One business operator uses it weekly for a real workflow.
- The product can show held approvals and audit history for actual agent actions.

### Phase 5: Distribution Scale
Timeline: only after activation metrics are real.

Ship:

- Docker/OCI MCP packaging if enterprise/devcontainer demand appears.
- More directory listings after package and security story are stable.
- Case studies from agency pilots.
- Comparison/migration SEO pages.
- Small paid retargeting.

Gate:

- Organic visitors activate, not just click.
- Paid traffic can be measured to quickstart completion or pilot application.

## Immediate Next Actions
1. Fix the video version/duration mismatch before any HN or Product Hunt push.
2. Add a docs page defining `microservices.sh System Harness`.
3. Add a 3-minute proof script and screenshots to the quickstart.
4. Instrument LP CTA events through analytics.
5. Run 10 agency/fractional CTO outreach messages using the revised wording.
6. Add one "AI app builder vs System Harness" compare page section.
7. Keep business-operator/ERP language in private pilot copy until durable runtime and approval persistence are live.

## Sources
- Stack Overflow 2025 AI survey: https://survey.stackoverflow.co/2025/ai
- Hacker News Show HN guidelines: https://news.ycombinator.com/showhn.html
- Cloudflare Agents docs: https://developers.cloudflare.com/agents/
- Lovable: https://lovable.dev/
- Bolt: https://bolt.new/

# Assumption Validation Results

Generated: 2026-06-13

## Bottom Line
Public research validates the macro opportunity, but not the purchase decision.

Validated enough to proceed with MVP discovery:

- Developers are using AI coding tools heavily.
- Developers distrust AI output enough to need verification.
- Agent-native developer platforms are emerging.
- Builders pay to avoid repetitive app setup.
- Cloudflare Workers for Platforms technically supports the managed platform model.

Not validated yet:

- Agencies will pay monthly for microservices.sh.
- Managed Cloudflare is preferred over BYO Cloudflare.
- Booking is the best first template.
- $49/$99/$299 is acceptable pricing.
- Developers trust our module abstraction after inspecting generated code.

## Validation Scorecard
| Assumption | Verdict | Confidence | Evidence | What Still Needs Testing |
|------------|---------|------------|----------|--------------------------|
| Developers use AI agents for real development | Validated at macro level | High | Stack Overflow 2025 reports 84% use or plan to use AI tools; 51% of professional developers use them daily | Our exact ICP: agencies, founders, consultants |
| Developers distrust AI-generated output | Validated | High | Stack Overflow 2025 reports more developers distrust AI output accuracy than trust it, and very few highly trust it | Which failure modes hurt our ICP most |
| Production-grade verification is a real pain | Strongly supported | High | Stack Overflow shows resistance around deployment/monitoring; recent security research and security-market coverage emphasize AI-generated code risks | Whether users see modules/hooks as the right solution |
| Agent-native infrastructure is an emerging category | Validated directionally | Medium | Medusa positions around agents/developers, modules, MCP, CLI, previews; Composio positions around agent-native integrations | Whether there is room for a broader business-app platform |
| Connectors are a bad first wedge | Supported | Medium | Composio already competes strongly on 1,000+ app integrations and agent tool calls | Which connectors are must-have for module workflows |
| Users pay to avoid repetitive setup | Validated as a proxy | Medium | ShipFast sells boilerplate/setup time savings around $199-$299 and claims thousands of makers | Whether users pay recurring for managed modules/deploys |
| Raw Cloudflare is too cheap to mark up directly | Validated | High | Workers Paid is $5/mo minimum; Workers for Platforms is $25/mo; WFP includes large usage allotments | Cost model under real user apps |
| Managed Cloudflare platform is technically feasible | Validated technically | High | Workers for Platforms is for running customer or AI-generated code in isolated Workers, with custom limits, observability, tags, and bindings | Operational burden, abuse controls, billing exposure |
| Users prefer managed Cloudflare over BYO | Not validated | Low | Managed deploys are a plausible friction reduction; no direct buyer evidence yet | Prototype test and interview choice exercise |
| Booking is the best first template | Partially supported | Low-Medium | Scheduling is a known complex workflow with payments, reminders, calendars, roles, and integrations; Cal.com pricing/features show mature demand | Compare booking vs invoice vs customer portal in interviews |
| $49/$99/$299 pricing is right | Plausible, not validated | Low-Medium | Anchors: ShipFast one-time $199-$299, Composio $29/$229, Medusa Cloud starts from $29, Vercel/Pages around $20-$25 | Van Westendorp, paid pilots, conversion tests |
| Agencies will pay monthly | Not validated | Low | Agencies are logically attractive because they repeat client work | 10 agency interviews, 3 paid pilot commitments |
| Developers will trust verified modules | Not validated | Low-Medium | Trust gap is real; source-visible modules are a plausible answer | Show generated code to target users and observe reaction |

## Evidence Notes

### AI Adoption And Trust Gap
Stack Overflow 2025 is the strongest current macro signal. It supports two points at once:

- AI development tools are mainstream.
- Trust is weak, especially for higher-accountability work.

This validates the need to sell confidence, verification, and production safety rather than raw speed.

Source:

- https://survey.stackoverflow.co/2025/ai

### Agent-Native Competitor Movement
Medusa is the clearest adjacent example. It positions as an open-source commerce platform for agents and developers, with modules, MCP, cloud CLI, previews, and "AI-enabling infrastructure."

Composio is the clearest connector competitor. It offers agent-native signup, 1,000+ apps, tool calls, delegated auth, and usage-based pricing.

Implication:

- "Agent-native" is not speculative anymore.
- We need sharper positioning around broader business apps, not commerce-only and not connectors-only.

Sources:

- https://medusajs.com/
- https://composio.dev/pricing

### Boilerplate Willingness-To-Pay
ShipFast proves that indie builders pay for saved setup time. It explicitly sells around repetitive setup: emails, Stripe webhooks, SEO, DNS, protected routes, and startup boilerplate. Its one-time pricing sits around $199-$299.

Implication:

- Saved setup time is monetizable.
- But ShipFast also creates a price anchor and substitute.
- microservices.sh must justify recurring pricing through managed deploys, updates, module versions, hooks, tests, and logs.

Source:

- https://shipfa.st/

### Managed Cloudflare Feasibility
Cloudflare Workers for Platforms directly supports the technical model: customer-written or AI-generated code running in isolated Workers, with per-customer controls, observability, tags, bindings, and custom domains.

Implication:

- The managed runtime model is feasible.
- The operational and buyer-preference question still needs primary validation.

Sources:

- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/

### Booking Template Evidence
Booking is a reasonable first wedge because it combines many reusable modules:

- auth
- customer
- availability
- staff/service catalog
- payments
- email/SMS reminders
- webhooks
- roles/permissions
- audit logs
- calendar integrations

Cal.com shows scheduling is a mature category with individual, team, organization, and enterprise plans, plus payments, webhooks, workflows, routing, branding, and compliance features.

Implication:

- Booking is complex enough to showcase modules.
- It is not yet proven as the best first template for our ICP.

Source:

- https://cal.com/pricing

## What I Would Change In The MVP Plan
Keep booking as the default MVP for now, but validate it against alternatives before coding too deeply.

During interviews, force a choice:

> If you could only get one production-ready template first, which would you pay for: booking, invoice, customer portal, order management, or SaaS starter?

If booking does not win among agencies/fractional CTOs, switch before implementation.

## Primary Validation Required
### Agency Validation
Need 10 agency/fractional CTO calls.

Pass:

- 5 have repeated app-foundation pain.
- 3 have a current client project where this could apply.
- 2 agree $299/month is plausible if it saves delivery time.
- 1 agrees to a paid pilot.

### Managed Cloudflare Validation
Run a choice test:

1. Managed Cloudflare, fastest path, usage limits.
2. BYO Cloudflare, more ownership, more setup.
3. Export-only repo, no managed runtime.

Pass:

- 50%+ of target users pick managed Cloudflare for first app.
- Advanced users still want BYO as later option, not MVP blocker.

### Pricing Validation
Run Van Westendorp questions around:

- $49 one-app Builder plan.
- $99 three-app Pro plan.
- $299 ten-app Agency plan.

Pass:

- 3 paid pilot commitments.
- 2 agencies say $299/month is acceptable for client work.
- fewer than half anchor only on raw Cloudflare cost.

### Module Trust Validation
Show generated code and module contract.

Pass:

- 60%+ say they would use it if code/tests are visible.
- fewer than 25% reject the abstraction outright.
- top concerns are addressable through docs, tests, export, or hooks.

## Updated Recommendation
Proceed with validation work, not full platform build.

Build only enough to test:

- landing page
- agent prompt demo
- module contract
- generated booking repo
- mock or concierge deploy
- pricing page

Do not build the managed runtime until the paid-pilot gate is met.

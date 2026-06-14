# Market Research Verification

## Status
This is a secondary marketing research pass, not full product validation.

What is verified:

- AI coding tools are widely used by developers.
- Trust in AI-generated output is a real problem.
- Competitors are already moving toward agent-native developer workflows.
- Buyers already pay for time-saving boilerplates and app foundations.
- Raw Cloudflare infrastructure is cheap, so microservices.sh must not be positioned as hosting markup.

What is not verified yet:

- That our exact ICP will pay for microservices.sh.
- That agencies prefer managed Cloudflare over BYO Cloudflare.
- That the booking-system wedge is the strongest first template.
- That $49/$99/$299 pricing clears real willingness-to-pay.
- That users trust our module abstraction after seeing generated code.

## Skills Used For This Verification
- `product-marketing`: clarified category, proposition, ICP, differentiation, objections, and language.
- `customer-research`: separated secondary market signal from missing primary VOC/customer interviews.
- `competitor-profiling`: reviewed adjacent competitors and substitutes.
- `pricing`: checked value metric, price anchors, and pricing frame versus direct Cloudflare.
- `launch`: checked whether the GTM plan has clear owned/rented/borrowed channels and staged launch gates.

## Research Sources Checked
| Source | What It Verifies | Implication |
|--------|------------------|-------------|
| Stack Overflow 2025 Developer Survey | 84% of respondents use or plan to use AI tools; 51% of professional developers use them daily; distrust in AI output is higher than trust | Strong macro demand for AI-assisted development, plus a trust gap we can position against |
| GitHub Octoverse 2024 | GitHub reports rapid growth in AI projects and broad developer growth connected to AI activity | Developer attention is shifting toward AI-native workflows |
| Medusa | Positions as an open-source commerce platform for agents and developers; emphasizes modules, MCP, cloud CLI, agent tools, previews | Agent-native modules are already a competitive pattern; we need a broader business-app niche, not commerce-only |
| Composio | Offers agent-native integrations, 1,000+ apps, usage-based pricing, and explicit agent signup flows | Connector space is competitive; connectors should support our app modules, not be the whole product |
| ShipFast | Sells a one-time boilerplate around $199-$299 and claims thousands of makers; messaging focuses on saving repetitive setup time | Buyers pay for saved setup time, but static boilerplates are a substitute and pricing anchor |
| Cloudflare Workers / Workers for Platforms / D1 / R2 pricing | Raw infrastructure cost is low | Our paid value must be verified modules, managed workflow, customization safety, tests, logs, and upgrades |

## Key Findings

### 1. AI Agent Adoption Is High, But Trust Is Weak
Confidence: High for macro trend, medium for exact ICP.

Stack Overflow's 2025 survey reports broad use or planned use of AI in development, but also reports that more developers distrust AI output accuracy than trust it. It also shows resistance around high-responsibility tasks like deployment and monitoring.

Implication:

> microservices.sh should sell confidence and verification, not just speed.

Positioning should emphasize:

- verified modules
- tests
- audit logs
- safe hooks
- deployment checks
- upgrade paths

### 2. Agent-Native Infrastructure Is Becoming A Category
Confidence: Medium.

Medusa now explicitly positions around agents and developers, with modules, MCP, CLI, previews, and cloud infrastructure. Composio also uses agent-native positioning for integrations.

Implication:

> The category exists, but the space is becoming crowded fast.

Our differentiation cannot be "we support agents." It must be:

- broader production business apps, not commerce-only
- managed Cloudflare app runtime
- app modules, not only connectors
- upgradeable source-visible foundations

### 3. Boilerplates Prove Willingness To Pay For Repeated Setup Pain
Confidence: Medium.

ShipFast sells a Next.js boilerplate with auth, email, payments, SEO, database, and related startup setup, with pricing around $199-$299 and public claims of thousands of users.

Implication:

> Users already pay to avoid repetitive setup. microservices.sh can charge more over time only if it delivers ongoing value: managed deploys, module updates, checks, logs, hooks, and upgrades.

### 4. Raw Cloudflare Is Cheap, So Pricing Must Be Value-Based
Confidence: High.

Cloudflare Workers and Workers for Platforms pricing is low enough that developers can easily compare us to infrastructure if our messaging is unclear.

Implication:

> Never frame the product as "managed Cloudflare hosting." Frame it as agent-native app infrastructure.

Pricing should be validated against developer labor/time saved, not against Cloudflare account cost.

### 5. Connector Market Is Not The Best First Wedge
Confidence: Medium.

Composio already competes strongly on agent tools, integrations, and delegated auth.

Implication:

> microservices.sh should not start as a connector marketplace.

Connectors should attach to modules and templates:

- Stripe connector for Payment
- Resend/Postmark connector for Email
- Google Calendar connector for Booking
- QuickBooks/Xero connector later for Invoice/Accounting

## Confidence Matrix
| Claim | Confidence | Why |
|-------|------------|-----|
| Developers are using AI coding tools heavily | High | Survey and market data support this |
| Developers have trust concerns with AI output | High | Stack Overflow survey directly supports this |
| Agent-native developer platforms are emerging | Medium | Competitor positioning supports it |
| Agencies will pay monthly for our exact product | Low | Needs interviews and paid pilot asks |
| Booking is the best first vertical | Low-Medium | Logical wedge, but not yet validated |
| $49/$99/$299 pricing will work | Low-Medium | Competitive anchors support plausibility, but WTP untested |
| Managed Cloudflare is a strong differentiator | Medium | Strong friction reduction hypothesis, needs prototype test |

## Required Primary Research
Before claiming product-market demand, complete:

1. 30 target interviews.
2. 10 agency/fractional CTO calls.
3. 5 observed agent build sessions.
4. 3 paid pilot commitments.
5. A landing page test with pricing and managed Cloudflare comparison.

## Research Questions To Add
- Do you compare this to Cloudflare, boilerplates, or developer labor?
- Which production parts did your agent fail at most recently?
- Would you trust a module if it is source-visible and test-covered?
- Would you use managed Cloudflare for a client app?
- What would make you prefer BYO Cloudflare?
- What is the most repeated client/business system you build?
- Which first template would you pay for: booking, invoice, customer portal, order management, or SaaS starter?

## Source Links
- Stack Overflow 2025 AI survey: https://survey.stackoverflow.co/2025/ai
- GitHub Octoverse 2024: https://github.blog/news-insights/octoverse/octoverse-2024/
- Medusa homepage: https://medusajs.com/
- Composio pricing: https://composio.dev/pricing
- ShipFast homepage/pricing: https://shipfa.st/
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Workers for Platforms pricing: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/
- R2 pricing: https://developers.cloudflare.com/r2/pricing/

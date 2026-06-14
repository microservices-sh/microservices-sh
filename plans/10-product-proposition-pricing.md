# Product Proposition And Pricing

## Canonical Product Proposition
microservices.sh lets developers use their own AI agent to compose verified Cloudflare-native modules and deploy production apps without setting up Cloudflare.

Short headline:

> Build production apps with your AI agent, using verified Cloudflare-native modules.

Expanded message:

> Bring Claude, Codex, or Cursor. Compose modules like Auth, Customer, Booking, Order, Payment, Email, Admin, and Audit Log. Customize through safe hooks. Deploy to managed Cloudflare without setup.

## Category
Use:

> Agent-native application infrastructure.

Do not lead with:

- SaaS builder
- no-code builder
- microservices marketplace
- Cloudflare wrapper
- hosting provider

SaaS is a supported output, not the product category.

## Niche
The first niche is:

> AI-heavy developers and agencies building custom business applications repeatedly.

Best early segments:

- dev agencies building client portals and business apps
- technical founders using agents to build products or internal systems
- fractional CTOs and consultants delivering repeatable workflows
- developers who tried agent-generated apps and hit production problems

First use-case wedge:

> Agent-built booking/customer/payment/email workflows on managed Cloudflare.

## Unique Selling Points
1. Agent-native, not dashboard-native.
2. Verified modules, not arbitrary generated snippets.
3. Managed Cloudflare deployment by default.
4. Safe customization through config and typed hooks.
5. Upgradeable module system with pinned versions and explicit upgrades.
6. Inspectable and exportable generated code.
7. Built for real business systems, including booking, invoicing, customer portals, internal tools, online stores, order workflows, and SaaS products.
8. Cloudflare-native cost/performance model with Workers, D1, R2, KV, Durable Objects, Queues, and Workers for Platforms.

## Pricing Frame
Do not price as a Cloudflare hosting markup.

Cloudflare's direct pricing is low. As checked on 2026-06-13:

- Cloudflare Workers Paid has a $5/month minimum account charge, with 10M included requests and 30M CPU ms included.
- Workers for Platforms is $25/month, with 20M included requests, 60M CPU ms, 1,000 scripts, and overage pricing.
- D1 is usage-based, with paid-plan included reads/writes/storage and row-based overages.
- R2 standard storage is usage-based at $0.015/GB-month, operation-based charges, and free egress.
- Cloudflare Pages Pro is $25/month when billed monthly.
- Vercel Pro is $20/month plus additional usage.

Sources:

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/
- https://pages.cloudflare.com/
- https://vercel.com/pricing

The pricing argument is:

> Cloudflare gives infrastructure primitives. microservices.sh gives agent-ready modules, safe customization, managed deployment, tests, logs, usage controls, and upgrade paths.

## Recommended Public Beta Pricing
| Plan | Price | Buyer | Includes |
|------|-------|-------|----------|
| Free | $0 | curious developers | docs, module browsing, local generation, limited templates, no managed production deploy |
| Builder | $49/month | solo developer or founder | 1 managed production app, preview deploys, core modules, basic usage limits |
| Pro | $99/month | serious builder | 3 managed production apps, logs, custom secrets, hooks, higher limits |
| Agency | $299/month | dev agencies | 10 managed production apps, client workspaces, team access, priority support |
| Enterprise | custom | teams with ownership/compliance needs | BYO Cloudflare, SSO, custom limits, security review, support |

## Included Usage Principle
Early plans should include enough usage for small apps and enforce hard limits.

Do not expose complex infrastructure metering on day one. Internally meter:

- requests
- CPU time
- deployed scripts/apps
- D1 reads/writes/storage
- R2 storage/operations
- KV operations
- logs
- build/deploy count

Externally expose simple limits:

- managed production apps
- preview apps/environments
- team seats
- custom domains
- included monthly usage
- support level

## Why Start At $49
At $20-$25/month, buyers compare microservices.sh to Cloudflare Pages, Vercel, or Netlify hosting. That is the wrong frame.

At $49/month, the frame becomes:

> This saves engineering time and gives agents a production-ready app foundation.

The first paid plan must be high enough to signal that the value is modules, deployment orchestration, and upgrade safety, not raw infrastructure.

## Competitive Comparison
| Alternative | What they sell | Why users still need microservices.sh |
|-------------|----------------|---------------------------------------|
| Cloudflare direct | infrastructure primitives | no agent-ready app modules, no app composition, no module upgrade path |
| Cloudflare Pages | static/app hosting and builds | not a verified business-module system |
| Vercel/Netlify | app hosting and deploy workflow | deploys code but does not provide agent-composable business modules |
| SaaS boilerplates | starter code | static, usually not managed, not module-upgradeable after customization |
| No-code builders | visual app creation | black-box logic and limited developer control |
| Connector platforms | integrations | do not provide full app foundations |

## Pricing Validation Questions
Ask:

- Would you compare this to hosting, boilerplates, or developer labor?
- What would this replace in your workflow?
- If it saved 5 to 10 hours per project, what is that worth?
- Would $49/month make sense for one managed app?
- Would $99/month make sense for three managed apps?
- Would $299/month make sense for an agency delivering client projects?
- What usage limit would make you nervous?
- Would you prefer managed Cloudflare, BYO Cloudflare, or export-only?

## Pricing Risks
- Pricing too low anchors us as hosting.
- Pricing too high before proof blocks early adoption.
- Usage overages too early create friction.
- Unlimited managed deploys create cost and abuse risk.
- BYO Cloudflare too early increases integration complexity.

## Recommendation
Launch with a simple subscription ladder:

> Free, Builder $49/month, Pro $99/month, Agency $299/month, Enterprise custom.

Use paid pilots to validate willingness to pay before finalizing public pricing.

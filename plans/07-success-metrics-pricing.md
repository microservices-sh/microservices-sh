# Success Metrics And Pricing

## North-Star Metric
Production applications deployed from verified modules.

Do not use "SaaS apps deployed" as the north star. SaaS is one possible output.

## Leading Indicators
Activation:

- create package runs
- successful local app creation
- local dev server started
- project CLI first command
- first `list_templates` call
- first `compose_app` call
- first generated project
- first test pass
- first preview deploy
- MCP installs after the CLI/create path is proven
- successful API/MCP key creation for managed preview or hosted MCP use

Engagement:

- modules inspected per user
- apps generated per user
- customization hooks used
- tests run
- logs viewed
- deployments promoted
- repeat projects

Revenue:

- paid pilots
- paid beta users
- MRR
- deployed paid projects
- agency workspaces
- usage overages

Reliability:

- deploy success rate
- test pass rate
- rollback success rate
- failed deployment recovery time
- support tickets per deployment

## MVP Success Gates
### Discovery Gate
- 30 target interviews.
- 10+ repeated production pain mentions.
- 5+ prototype testers.
- 3+ paid pilot commitments.

### Prototype Gate
- 5 external users generate a working app.
- 3 preview deploys.
- median first app under 60 minutes.
- fewer than 2 manual interventions per pilot.

### Paid Beta Gate
- 10 paid customers.
- 5 active deployed apps.
- 2 agencies using it for client work.
- 40%+ weekly active usage among paid customers.

### Early Business Gate
- $5k MRR within 6 months.
- 3 agencies each deploy 2+ apps.
- at least one customer asks for a second template.

## Pricing Frame
Do not price microservices.sh as a Cloudflare hosting markup.

Cloudflare's raw infrastructure is inexpensive. As checked on 2026-06-13:

- Cloudflare Workers Paid has a $5/month minimum account charge, 10M included requests, and 30M CPU ms included.
- Workers for Platforms is $25/month, with 20M included requests, 60M CPU ms, 1,000 scripts, and overage pricing.
- D1 is usage-based and row-based, with paid-plan included reads/writes/storage.
- R2 is usage-based for storage and operations, with free egress.
- Cloudflare Pages Pro is $25/month when billed monthly.
- Vercel Pro is $20/month plus additional usage.

Sources:

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/
- https://pages.cloudflare.com/
- https://vercel.com/pricing

The customer should understand that they are paying for:

- agent-ready module contracts
- verified app foundations
- managed Cloudflare deployment
- safe customization
- logs and usage controls
- upgrade paths
- less production debugging

## Initial Pricing Hypothesis
| Plan | Price | Buyer | Includes |
|------|-------|-------|----------|
| Free | $0 | curious developers | docs, module browsing, local generation, limited templates, no managed production deploy |
| Builder | $49/month | solo developer or founder | 1 managed production app, preview deploys, core modules, basic usage limits |
| Pro | $99/month | serious builder | 3 managed production apps, logs, custom secrets, hooks, higher limits |
| Agency | $299/month | dev agencies | 10 managed production apps, client workspaces, team access, priority support |
| Enterprise | custom | ownership/compliance teams | BYO Cloudflare, SSO, custom limits, procurement/security support |

## Pricing Research Questions
Ask in interviews:

- What would this replace?
- How much time would it save per project?
- What is one failed AI-generated app worth in wasted time?
- Would you pay monthly if deployments and module updates are managed?
- Would you prefer one-time license, monthly subscription, or usage markup?
- At what price is this too expensive?
- At what price does it feel too cheap to trust?
- What would make an agency plan worth $299/month?

## Value Metric Options
Best first value metric:

- number of managed production apps/projects

Secondary metrics:

- deployment environments
- team seats
- usage limits
- premium modules
- support level

Avoid first:

- per-agent-message pricing
- per-module pricing
- complex request metering as the main price

Cloudflare usage can be metered internally and exposed as limits/overages later.

## Included Usage Principle
Early pricing should use simple plan limits, not raw infrastructure line items.

Expose:

- production apps
- preview apps/environments
- team seats
- support level
- custom domains
- included monthly usage band

Meter internally:

- requests
- CPU time
- deployed scripts/apps
- D1 reads/writes/storage
- R2 storage/operations
- KV operations
- logs
- deployment count

## Revenue Model
Start with subscription. Add usage later.

Why:

- simpler to buy
- aligns with maintained modules
- supports recurring updates
- easier for agencies to expense

Potential future revenue:

- usage markup
- premium connectors
- marketplace revenue share
- BYO enterprise plan
- paid implementation support

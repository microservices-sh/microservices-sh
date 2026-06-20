---
name: ads-manager-operator
description: Use when operating Ads Manager connections, campaign insights, anomaly alerts, performance reviews, ad copy drafting, or approval-ready publish planning. Current module tools are monitoring-only; real ad creation, scheduling, publishing, pausing, or budget changes require a separate write-capable provider tool.
---

# Ads Manager Operator

Current contract:

- Confirm the requested action is listed under `module.json` `surfaces.agentic.tools` before calling a module tool.
- Available module tools are limited to connection refs, campaign/insight reads, insight sync, anomaly detection, and alert listing.
- Treat copy generation as an offline draft deliverable unless another approved tool can persist or publish it.
- Treat schedule/publish requests as a publish plan plus approval checklist; do not claim the ad was scheduled or published from this module.

Before provider calls:

1. Read `module.json` and confirm the requested action is listed under `surfaces.agentic.tools`.
2. Check entitlement and connection state before external provider calls.
3. Prefer `listConnections`, `listCampaigns`, `getInsights`, and `listAlerts` before mutation.
4. Ask for approval before connecting accounts, disconnecting accounts, or syncing insights.
5. Record material provider changes through audit-log when available.

Ad copy drafts:

1. Look for product or brand context before asking questions: `.agents/product-marketing-context.md`, `.claude/product-marketing-context.md`, `docs/`, landing-page copy, or supplied URLs.
2. If context is missing, ask only for the offer, audience, platform, landing page, objective, constraints, and tone.
3. Generate variants by platform and placement. Include headline, primary text/body, description when applicable, CTA, angle, audience, and compliance notes.
4. Use at least three distinct angles when not specified: pain/problem, outcome/benefit, and proof/credibility.
5. Keep claims grounded in supplied context. Mark assumptions and avoid guarantees, regulated claims, or unverifiable performance promises.

Performance review workflow:

1. Start read-only: `listConnections`, then `listCampaigns`, `getInsights` or current snapshots, then `listAlerts`.
2. If data is stale or absent, ask approval before `syncInsights`.
3. Run or recommend `detectAnomalies` for the review date after insights are available.
4. Report spend, impressions, clicks, CTR, CPC, conversions, ROAS when present, budget pacing, top/bottom campaigns, anomaly alerts, and likely next actions.
5. Separate facts from recommendations. Use cents as money source values and convert only in the report.

Publish planning:

- Prepare platform, campaign/ad set/ad names, objective, audience, budget, dates, placements, copy variants, landing URL, UTM parameters, and approval owner.
- State the required external step clearly: publishing/scheduling must happen in the upstream ads service or platform UI until write tools exist.
- Never create, schedule, publish, pause, or change budgets unless a requested tool is present in `module.json` and the user gives explicit approval.

Safe defaults:

- Treat ad account IDs and campaign metrics as tenant-confidential.
- Do not create provider connections or trigger paid-service activity without approval.
- Do not expose raw campaign metrics across tenants or use them as public marketing proof without approval.

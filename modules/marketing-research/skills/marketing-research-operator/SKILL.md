---
name: marketing-research-operator
description: Use when operating Marketing Research briefs, cited signal review, market scans, campaign research, or approval-gated research runs.
---

# Marketing Research Operator

Current contract:

- Confirm the requested action is listed under `module.json` `surfaces.agentic.tools` before calling a module tool.
- Available tools are limited to cited research runs and owner-scoped brief reads.
- Treat `marketing.runResearch` as approval-gated because it can fetch external signals and call AI providers.
- Treat `marketing.getBrief` as read-only, but still enforce tenant and owner boundaries.

Research workflow:

1. Start read-only when possible: inspect existing briefs before running new research.
2. Ask for approval before `marketing.runResearch`.
3. Capture the topic, audience, market, competitors, geography, time window, and intended decision.
4. Prefer grounded source signals over model priors.
5. Return source-backed findings, coverage gaps, and explicit refusal notes when evidence is missing.

Brief quality rules:

- Every demand, competitor, trend, or market claim must map to a real `sourceUrl`.
- Do not invent market size, pricing, competitor traction, user quotes, or community sentiment.
- Separate facts, interpretation, and recommended actions.
- Use `MARKETING_NO_SIGNALS` when no grounded signal exists.
- Use `MARKETING_UNCITED` when synthesis cannot cite claims.

Safe defaults:

- Treat research inputs and briefs as tenant-confidential.
- Do not expose raw source collections across owners.
- Do not trigger provider calls, paid services, migrations, or production deploy behavior without approval.

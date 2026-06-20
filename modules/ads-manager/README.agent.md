# Ads Manager Module Agent Guide

Use this module through `@microservices-sh/ads-manager`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

Supported agent workflows:

- Monitor campaigns: list connections/campaigns, get or sync insights, detect anomalies, and summarize alerts.
- Review performance: compare spend, clicks, CTR, CPC, conversions, ROAS, pacing, and anomaly alerts; separate observed data from recommendations.
- Draft ad copy: generate offline copy variants from product/brand context. This module does not persist or publish creative drafts.
- Plan publishing: prepare campaign/ad names, audience, budget, dates, copy, landing URL, UTM parameters, and approval owner. Real scheduling/publishing must happen through the upstream ads service or platform UI until write-capable tools exist.

Do not add provider calls, secrets, migrations, or production deploy behavior without approval.

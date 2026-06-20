# Marketing Research Module Agent Guide

Use this module through `@microservices-sh/marketing-research`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

Supported agent workflows:

- Inspect saved briefs with `marketing.getBrief`.
- Prepare a research run plan with topic, channels, expected cost/egress, and approval owner.
- Run cited research only after explicit approval because it may fetch external signals and call an AI provider.
- Summarize only the claims present in the brief and citations returned by the module.

Do not present uncited demand, competitor, pricing, or channel claims. If the module returns `MARKETING_NO_SIGNALS` or `MARKETING_UNCITED`, surface that refusal instead of filling the gap.

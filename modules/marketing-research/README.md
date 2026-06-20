# Marketing Research Module

Status: `available`

Composable, cited marketing research for operator workflows. The module pulls
external demand, competitive, and community signals through swappable ports,
then produces a marketing brief that cites every claim or refuses when nothing
grounds it.

This module is available for contract/catalog use. Research runs remain
approval-gated because they can trigger external signal fetches and AI-provider
calls.

## What It Does

- Runs topic research through a `SocialListenPort`.
- Synthesizes a brief through a cite-constrained `Synthesizer`.
- Refuses ungrounded output with `MARKETING_NO_SIGNALS`.
- Refuses uncited synthesis with `MARKETING_UNCITED`.
- Saves owner-scoped briefs.
- Emits `marketing.brief_created` events.
- Records optional audit entries.

## Public Surface

```ts
import {
  createMemoryMarketingStore,
  getBrief,
  runResearch
} from "@microservices-sh/marketing-research";
```

Primary use cases:

- `runResearch(input, deps)` - approval-gated external research run.
- `getBrief(input, deps)` - read an owner-scoped brief.

## Resources And Connections

- D1 `DB` tables: `marketing_briefs`, `signal_snapshots`, `domain_events`.
- Required connection: `org-team-rbac`.
- Optional connections: `ai-gateway`, `audit-log`, `jobs-workflows`,
  `notifications-inapp`, `research`.
- Permissions: `marketing.read`, `marketing.run`, `marketing.admin`,
  `marketing.observe`.

## Approval Gates

Require approval before:

- migrations
- external signal fetches
- AI-provider calls
- production deploy behavior

Agents must not invent demand, competitor, or source claims. Every claim in a
brief must map to a real `sourceUrl`; otherwise the module refuses the result.

## Develop

```bash
pnpm --filter @microservices-sh/marketing-research build
pnpm --filter @microservices-sh/marketing-research check:spec
```

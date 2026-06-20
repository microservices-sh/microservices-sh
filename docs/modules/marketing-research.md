# Marketing Research

Status: available
Module ID: `marketing-research`
Mount: `/marketing-research`

## Summary
Composable, cited marketing research: pull external demand, competitive, and
community signals through swappable ports, snapshot over time, and produce
cite-or-refuse marketing briefs.

Marketing Research is available as a governed research module. Research runs
remain approval-gated because they can trigger external signal fetches and AI
provider calls.

## Dependencies
- org-team-rbac

Optional integrations:

- ai-gateway
- audit-log
- jobs-workflows
- notifications-inapp
- research

## Permissions
- marketing.read
- marketing.run
- marketing.admin
- marketing.observe

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not
request or print secret values.

## Resources
- D1

Tables:

- marketing_briefs
- signal_snapshots
- domain_events

## RPC
- `runResearch` with `marketing.run`
- `getBrief` with `marketing.read`

## Hooks
- afterBriefCreated

## Events
- marketing.brief_created
- marketing.signal_alert

## Approval Gate
Risk: low

Require explicit approval before:

- migrations
- external signal fetches
- AI-provider calls
- production deploy behavior

## Agent Rules
- Start read-only with `getBrief` when possible.
- Ask for approval before `runResearch`.
- Cite every demand, competitor, pricing, community, or channel claim.
- Return `MARKETING_NO_SIGNALS` when no grounded signal exists.
- Return `MARKETING_UNCITED` when synthesis cannot cite claims.
- Never fill coverage gaps with model priors or invented proof.

## Source Reference
Generated registries resolve this module through:

```text
modules/marketing-research/v0.1.0
```

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks
require manual or agent-assisted merge review.

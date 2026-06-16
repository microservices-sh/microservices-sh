# Ads Manager Module

Status: `available`

Cross-platform ad **monitoring** (Meta, Google) over an upstream ads service.
Records per-day insight **snapshots** to D1, raises **anomaly alerts**, and exposes
a normalized campaign view. A paid, entitlement-gated connector ($1.90/mo).

## Why an upstream service

The Meta app (reviewed ads scopes), Google Ads OAuth client + developer token,
OAuth flows, encrypted tokens, and the Graph/GAQL calls all live **once** in the
upstream service (openclaw-launcher) — never re-implemented per app. This module
holds a connection **reference** (`externalRef`), not platform tokens, and adds
the monitoring/alerting layer + honeycomb wiring.

## Billing / entitlement

Sold as a premium marketplace connector at **$1.90/mo**; microservices.sh is
merchant-of-record (20% cut), the upstream provider nets the rest. Paid use-cases
call `Entitlement.check(tenantId)` first and return **402 `ads.NOT_ENTITLED`** when
the subscription is inactive. The host implements `Entitlement` against
`billing-subscriptions` and mints a signed `ads.service` token (via the `auth`
module) that the `openclaw` connector forwards as `X-Ads-Entitlement` for the
upstream to verify (JWKS).

## Public surface

```ts
import {
  connectAccount, listConnections, disconnectAccount,   // connection refs
  listCampaigns, getInsights,                            // entitlement-gated reads
  syncInsights, detectAnomalies, listAlerts,             // monitoring engine
  buildConnector,                                        // host wiring (env → connector)
  createMemoryAdsStore, createD1AdsStore,
  createMemoryConnector, createOpenclawConnector, createMemoryEntitlement,
} from "@microservices-sh/ads-manager";
```

- `syncInsights` (host cron via `jobs-workflows`) upserts one day's per-campaign
  snapshots — idempotent per `(connection, campaign, date)`.
- `detectAnomalies` compares each campaign vs its trailing-window baseline and
  raises typed alerts (`spend_spike` / `cpc_spike` / `zero_conv`), deduped per day.
- Dashboards read snapshots/alerts; the upstream API is only hit on sync/live pull.

## Resources & connections

- D1 `DB` → `ad_connections`, `ad_insight_snapshots`, `ad_alerts` (migration `0001_ads.sql`)
- optional: `auth` (gate + entitlement token), `audit-log` (event trail),
  `billing-subscriptions` (the $1.90 plan), `jobs-workflows` (sync cron),
  `notifications-inapp` (alert delivery)
- emits `ad.account_connected/disconnected`, `ad.insights_synced`, `ad.alert_raised`

## Develop

```bash
pnpm --filter @microservices-sh/ads-manager test    # vitest (memory adapters + stub fetch)
pnpm --filter @microservices-sh/ads-manager build   # tsc --noEmit
pnpm spec:check -- module modules/ads-manager
```

## Scope

v1 = **Monitor tier** (read + snapshot + alerts). Campaign **management** (create/
pause/budget) and the **Google** connector are follow-on tiers; Google requires the
upstream developer-token (external approval), and management needs Meta write-scope
review — both handled in the upstream service, not here.

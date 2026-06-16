import { ok, err } from "@microservices-sh/connection-contract";
import { syncInsightsInputSchema } from "../schemas";
import { beforeSync } from "../hooks";
import { snapshotId } from "../keys";
import { adsManagerMeta } from "../meta";
import type { AdsConnector, AdsStore, Entitlement } from "../ports";
import type { InsightSnapshot } from "../types";

export interface SyncInsightsDeps {
  store: AdsStore;
  connector: AdsConnector;
  entitlement: Entitlement;
  entitlementToken?: string;
  now?: () => number;
  correlationId?: string;
}

// Pull one day's per-campaign insights from the upstream service and upsert them
// as snapshots. Idempotent per (connection, campaign, date). A host cron (via
// jobs-workflows) calls this daily per active connection.
export async function syncInsights(input: unknown, deps: SyncInsightsDeps) {
  const meta = adsManagerMeta(deps);
  const parsed = syncInsightsInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "ads.INVALID_INPUT", message: "Sync input is invalid.", issues: parsed.error.issues }, meta);
  }

  const hooked = await beforeSync(parsed.data);
  if (!hooked) return ok(200, { synced: 0, skipped: true }, meta);

  const entitled = await deps.entitlement.check(hooked.tenantId);
  if (!entitled.active) {
    return err(402, { code: "ads.NOT_ENTITLED", message: entitled.reason ?? "Active ads subscription required ($1.90/mo)." }, meta);
  }

  const conn = await deps.store.getConnection(hooked.tenantId, hooked.connectionId);
  if (!conn) return err(404, { code: "ads.CONNECTION_NOT_FOUND", message: "Connection not found." }, meta);

  const rows = await deps.connector.getInsights(
    { tenantId: hooked.tenantId, entitlementToken: deps.entitlementToken },
    conn.externalRef,
    { since: hooked.date, until: hooked.date },
  );

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const snapshots: InsightSnapshot[] = rows.map((r) => ({
    ...r,
    id: snapshotId(conn.id, r.campaignId, r.date),
    connectionId: conn.id,
    tenantId: conn.tenantId,
    platform: conn.platform,
    raw: null,
    createdAt: nowIso,
  }));
  await deps.store.upsertSnapshots(snapshots);

  const event = {
    name: "ad.insights_synced",
    correlationId: meta.correlationId,
    payload: { connectionId: conn.id, tenantId: conn.tenantId, date: hooked.date, count: snapshots.length },
  };
  return ok(200, { synced: snapshots.length, date: hooked.date, event }, meta);
}

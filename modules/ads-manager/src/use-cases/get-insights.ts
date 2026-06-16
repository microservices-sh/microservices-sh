import { ok, err } from "@microservices-sh/connection-contract";
import { insightsQuerySchema } from "../schemas";
import { adsManagerMeta } from "../meta";
import { mapConnectorError } from "./list-campaigns";
import type { AdsConnector, AdsStore, Entitlement } from "../ports";

export interface GetInsightsDeps {
  store: AdsStore;
  connector: AdsConnector;
  entitlement: Entitlement;
  entitlementToken?: string;
  correlationId?: string;
}

// Live insights pull (entitlement-gated). For dashboards prefer reading snapshots;
// this hits the upstream service directly.
export async function getInsights(input: unknown, deps: GetInsightsDeps) {
  const meta = adsManagerMeta(deps);
  const parsed = insightsQuerySchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "ads.INVALID_INPUT", message: "Query is invalid.", issues: parsed.error.issues }, meta);
  }

  const entitled = await deps.entitlement.check(parsed.data.tenantId);
  if (!entitled.active) {
    return err(402, { code: "ads.NOT_ENTITLED", message: entitled.reason ?? "Active ads subscription required ($1.90/mo)." }, meta);
  }

  const conn = await deps.store.getConnection(parsed.data.tenantId, parsed.data.connectionId);
  if (!conn) return err(404, { code: "ads.CONNECTION_NOT_FOUND", message: "Connection not found." }, meta);

  let insights;
  try {
    insights = await deps.connector.getInsights(
      { tenantId: parsed.data.tenantId, entitlementToken: deps.entitlementToken },
      conn.externalRef,
      { since: parsed.data.since, until: parsed.data.until },
    );
  } catch (e) {
    const mapped = mapConnectorError(e, meta);
    if (mapped) return mapped;
    throw e;
  }
  return ok(200, { insights, count: insights.length }, meta);
}

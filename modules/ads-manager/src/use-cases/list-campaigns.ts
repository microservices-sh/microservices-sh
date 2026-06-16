import { ok, err } from "@microservices-sh/connection-contract";
import { insightsQuerySchema } from "../schemas";
import { adsManagerMeta } from "../meta";
import type { AdsConnector, AdsStore, Entitlement } from "../ports";

export interface ListCampaignsDeps {
  store: AdsStore;
  connector: AdsConnector;
  entitlement: Entitlement;
  entitlementToken?: string;
  correlationId?: string;
}

// Paid, entitlement-gated read: the $1.90/mo ads subscription must be active
// before the upstream service is called.
export async function listCampaigns(input: unknown, deps: ListCampaignsDeps) {
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

  const campaigns = await deps.connector.listCampaigns(
    { tenantId: parsed.data.tenantId, entitlementToken: deps.entitlementToken },
    conn.externalRef,
    { since: parsed.data.since, until: parsed.data.until },
  );
  return ok(200, { campaigns, count: campaigns.length, platform: conn.platform }, meta);
}

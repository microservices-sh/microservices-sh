import { ok, err } from "@microservices-sh/connection-contract";
import { insightsQuerySchema } from "../schemas";
import { adsManagerMeta } from "../meta";
import { AdsServiceError } from "../adapters/openclaw-connector";
import type { AdsConnector, AdsStore, Entitlement } from "../ports";

// Map an upstream connector failure to a Result envelope. notEntitled (402 from
// the ads service) is surfaced as ads.NOT_ENTITLED; anything else as 502.
export function mapConnectorError(e: unknown, meta: ReturnType<typeof adsManagerMeta>) {
  if (e instanceof AdsServiceError && e.notEntitled) {
    return err(402, { code: "ads.NOT_ENTITLED", message: "Upstream ads service rejected the entitlement." }, meta);
  }
  if (e instanceof AdsServiceError) {
    return err(502, { code: "ads.UPSTREAM_ERROR", message: e.message }, meta);
  }
  return null;
}

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

  let campaigns;
  try {
    campaigns = await deps.connector.listCampaigns(
      { tenantId: parsed.data.tenantId, entitlementToken: deps.entitlementToken },
      conn.externalRef,
      { since: parsed.data.since, until: parsed.data.until },
    );
  } catch (e) {
    const mapped = mapConnectorError(e, meta);
    if (mapped) return mapped;
    throw e;
  }
  return ok(200, { campaigns, count: campaigns.length, platform: conn.platform }, meta);
}

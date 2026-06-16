import type { AdsConnector } from "../ports";
import type { ConnectorContext, DateRange, InsightRow, NormalizedCampaign } from "../types";

export interface OpenclawConnectorOptions {
  // Base URL of the upstream ads service (openclaw), e.g. https://api.oclauncher.com
  baseUrl: string;
  // Static service key for the M2M lane (host-configured).
  serviceKey: string;
  fetchImpl?: typeof fetch;
}

export class AdsServiceError extends Error {
  constructor(message: string, public status: number, public detail?: string) {
    super(message);
    this.name = "AdsServiceError";
  }
  // 402 = not entitled (subscription lapsed); surfaced to the host as "subscribe".
  get notEntitled(): boolean {
    return this.status === 402;
  }
}

// Connector to openclaw's normalized M2M ads API. Forwards the per-tenant signed
// entitlement token (the `ads.service` JWT) so the upstream can verify the
// $1.90/mo subscription before returning data.
export function createOpenclawConnector(opts: OpenclawConnectorOptions): AdsConnector {
  const doFetch = opts.fetchImpl ?? fetch;

  async function call<T>(ctx: ConnectorContext, path: string, query: Record<string, string>): Promise<T> {
    const url = new URL(`${opts.baseUrl}${path}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const res = await doFetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${opts.serviceKey}`,
        "X-Tenant-Id": ctx.tenantId,
        // Signed entitlement (auth `ads.service` JWT) — upstream verifies via JWKS.
        ...(ctx.entitlementToken ? { "X-Ads-Entitlement": ctx.entitlementToken } : {}),
      },
    });
    if (!res.ok) {
      throw new AdsServiceError(`Ads service ${path} failed`, res.status, await res.text().catch(() => undefined));
    }
    const body = (await res.json()) as { ok?: boolean; data?: T; error?: { message?: string } };
    if (body.ok === false) throw new AdsServiceError(body.error?.message ?? "Ads service error", 502);
    return (body.data ?? body) as T;
  }

  return {
    async listCampaigns(ctx, externalRef, range) {
      const data = await call<{ campaigns: NormalizedCampaign[] }>(ctx, `/api/ads/${externalRef}/campaigns`, {
        since: range.since,
        until: range.until,
      });
      return data.campaigns ?? [];
    },
    async getInsights(ctx, externalRef, range) {
      const data = await call<{ insights: InsightRow[] }>(ctx, `/api/ads/${externalRef}/insights`, {
        since: range.since,
        until: range.until,
      });
      return data.insights ?? [];
    },
    async grantConnection(ctx, externalRef) {
      const res = await doFetch(`${opts.baseUrl}/api/ads/grants`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.serviceKey}`,
          "Content-Type": "application/json",
          "X-Tenant-Id": ctx.tenantId,
          ...(ctx.entitlementToken ? { "X-Ads-Entitlement": ctx.entitlementToken } : {}),
        },
        body: JSON.stringify({ connectionId: externalRef }),
      });
      if (!res.ok) {
        throw new AdsServiceError("Ads service grant failed", res.status, await res.text().catch(() => undefined));
      }
    },
  };
}

import { describe, it, expect } from "vitest";
import { createOpenclawConnector, AdsServiceError } from "./openclaw-connector";

function jsonRes(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

describe("openclaw connector", () => {
  it("forwards the entitlement token + tenant + service key, and parses campaigns", async () => {
    let seen: Record<string, string | null> = {};
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      seen = {
        url: String(url),
        auth: h.get("Authorization"),
        tenant: h.get("X-Tenant-Id"),
        entitlement: h.get("X-Ads-Entitlement"),
      };
      return jsonRes({ ok: true, data: { campaigns: [{ id: "c1", name: "A", status: "active", spendCents: 100, impressions: 10, clicks: 1, ctr: 10, cpcCents: 100, conversions: 0 }] } });
    }) as unknown as typeof fetch;

    const c = createOpenclawConnector({ baseUrl: "https://api.test", serviceKey: "svc-key", fetchImpl });
    const out = await c.listCampaigns({ tenantId: "t1", entitlementToken: "jwt-abc" }, "oc_conn_1", { since: "2026-06-01", until: "2026-06-10" });

    expect(out).toHaveLength(1);
    expect(seen.url).toContain("/api/ads/oc_conn_1/campaigns");
    expect(seen.auth).toBe("Bearer svc-key");
    expect(seen.tenant).toBe("t1");
    expect(seen.entitlement).toBe("jwt-abc");
  });

  it("grantConnection POSTs /api/ads/grants with the service key, tenant, entitlement + connectionId", async () => {
    let seen: { url?: string; method?: string; auth?: string | null; tenant?: string | null; entitlement?: string | null; body?: string } = {};
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      seen = { url: String(url), method: init?.method, auth: h.get("Authorization"), tenant: h.get("X-Tenant-Id"), entitlement: h.get("X-Ads-Entitlement"), body: init?.body as string };
      return jsonRes({ ok: true, data: { connectionId: "oc_conn_1", subject: "org-1" } }, 201);
    }) as unknown as typeof fetch;

    const c = createOpenclawConnector({ baseUrl: "https://api.test", serviceKey: "svc", fetchImpl });
    await c.grantConnection!({ tenantId: "org-1", entitlementToken: "jwt-ent" }, "oc_conn_1");

    expect(seen.method).toBe("POST");
    expect(seen.url).toBe("https://api.test/api/ads/grants");
    expect(seen.auth).toBe("Bearer svc");
    expect(seen.tenant).toBe("org-1");
    expect(seen.entitlement).toBe("jwt-ent");
    expect(JSON.parse(seen.body!)).toEqual({ connectionId: "oc_conn_1" });
  });

  it("grantConnection throws AdsServiceError on a non-ok response", async () => {
    const fetchImpl = (async () => jsonRes({ error: "no" }, 403)) as unknown as typeof fetch;
    const c = createOpenclawConnector({ baseUrl: "https://api.test", serviceKey: "svc", fetchImpl });
    await expect(c.grantConnection!({ tenantId: "org-1" }, "ref")).rejects.toMatchObject({ status: 403 });
  });

  it("maps a 402 to a notEntitled AdsServiceError", async () => {
    const fetchImpl = (async () => jsonRes({ error: "subscribe" }, 402)) as unknown as typeof fetch;
    const c = createOpenclawConnector({ baseUrl: "https://api.test", serviceKey: "k", fetchImpl });
    await expect(c.getInsights({ tenantId: "t1" }, "ref", { since: "2026-06-01", until: "2026-06-10" })).rejects.toMatchObject({ status: 402 });
    try {
      await c.getInsights({ tenantId: "t1" }, "ref", { since: "2026-06-01", until: "2026-06-10" });
    } catch (e) {
      expect(e).toBeInstanceOf(AdsServiceError);
      expect((e as AdsServiceError).notEntitled).toBe(true);
    }
  });
});

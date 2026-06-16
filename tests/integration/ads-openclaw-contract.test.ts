import { describe, it, expect } from "vitest";
import {
  connectAccount,
  listCampaigns,
  syncInsights,
  createMemoryAdsStore,
  createMemoryEntitlement,
  createOpenclawConnector,
} from "@microservices-sh/ads-manager";
import type { AdsStore } from "@microservices-sh/ads-manager";

// A stub of openclaw's /api/ads M2M contract (exactly what apps/api/src/routes/
// ads-service.ts returns). This proves the module's real openclaw-connector
// speaks that contract — path, headers, and { ok, data:{ campaigns|insights } }.
function openclawStub(opts: { entitled?: boolean } = { entitled: true }) {
  const seen: { url?: string; auth?: string | null; tenant?: string | null; entitlement?: string | null } = {};
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const h = new Headers(init?.headers);
    seen.url = u;
    seen.auth = h.get("Authorization");
    seen.tenant = h.get("X-Tenant-Id");
    seen.entitlement = h.get("X-Ads-Entitlement");
    if (!opts.entitled) return json({ ok: false, error: { code: "ads.NOT_ENTITLED", message: "subscribe" } }, 402);
    if (u.includes("/campaigns")) {
      return json({ ok: true, data: { campaigns: [{ id: "c1", name: "Prospecting", status: "active", spendCents: 4812, impressions: 10000, clicks: 200, ctr: 2, cpcCents: 24, conversions: 0 }] } });
    }
    if (u.includes("/insights")) {
      const until = new URL(u).searchParams.get("until")!;
      return json({ ok: true, data: { insights: [{ campaignId: "c1", campaignName: "Prospecting", date: until, spendCents: 3000, impressions: 4000, clicks: 160, conversions: 12, ctr: 4, cpcCents: 19 }] } });
    }
    return json({ ok: false, error: { message: "not found" } }, 404);
  }) as unknown as typeof fetch;
  return { fetchImpl, seen };
}

async function connect(store: AdsStore) {
  const r = await connectAccount({ tenantId: "t1", platform: "meta", adAccountId: "act_1", externalRef: "oc_conn_1" }, { store });
  if (!r.ok) throw new Error("connect failed");
  return (r.data as { connection: { id: string } }).connection.id;
}

describe("ads-manager ↔ openclaw /api/ads contract", () => {
  it("listCampaigns reaches the right path with service key + tenant + entitlement, and parses the response", async () => {
    const store = createMemoryAdsStore();
    const id = await connect(store);
    const { fetchImpl, seen } = openclawStub();
    const connector = createOpenclawConnector({ baseUrl: "https://oc.test", serviceKey: "svc", fetchImpl });

    const r = await listCampaigns(
      { tenantId: "t1", connectionId: id, since: "2026-06-01", until: "2026-06-10" },
      { store, connector, entitlement: createMemoryEntitlement(true), entitlementToken: "jwt-ent" },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.count).toBe(1);
    expect(seen.url).toContain("/api/ads/oc_conn_1/campaigns");
    expect(seen.auth).toBe("Bearer svc");
    expect(seen.tenant).toBe("t1");
    expect(seen.entitlement).toBe("jwt-ent");
  });

  it("syncInsights stores snapshots from the upstream insights payload", async () => {
    const store = createMemoryAdsStore();
    const id = await connect(store);
    const { fetchImpl } = openclawStub();
    const connector = createOpenclawConnector({ baseUrl: "https://oc.test", serviceKey: "svc", fetchImpl });

    const r = await syncInsights(
      { tenantId: "t1", connectionId: id, date: "2026-06-10" },
      { store, connector, entitlement: createMemoryEntitlement(true), entitlementToken: "jwt-ent" },
    );
    expect(r.ok).toBe(true);
    const snaps = await store.listSnapshots({ tenantId: "t1" });
    expect(snaps.length).toBe(1);
    expect(snaps[0]).toMatchObject({ campaignId: "c1", date: "2026-06-10", spendCents: 3000, conversions: 12 });
  });

  it("surfaces an upstream 402 as ads.NOT_ENTITLED through the use-case", async () => {
    const store = createMemoryAdsStore();
    const id = await connect(store);
    const { fetchImpl } = openclawStub({ entitled: false });
    const connector = createOpenclawConnector({ baseUrl: "https://oc.test", serviceKey: "svc", fetchImpl });

    // Module-side entitlement says active, but the upstream service rejects (402).
    const r = await listCampaigns(
      { tenantId: "t1", connectionId: id, since: "2026-06-01", until: "2026-06-10" },
      { store, connector, entitlement: createMemoryEntitlement(true), entitlementToken: "stale-jwt" },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(402);
      expect(r.error.code).toBe("ads.NOT_ENTITLED");
    }
  });
});

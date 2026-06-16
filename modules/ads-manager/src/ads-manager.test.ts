import { describe, it, expect } from "vitest";
import {
  connectAccount,
  listConnections,
  disconnectAccount,
  listCampaigns,
  syncInsights,
  detectAnomalies,
  listAlerts,
  createMemoryAdsStore,
  createMemoryConnector,
  createMemoryEntitlement,
} from "./index";
import type { AdsStore, InsightSnapshot } from "./index";

const T0 = Date.parse("2026-06-10T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

async function connect(store: AdsStore, tenantId = "t1") {
  const r = await connectAccount(
    { tenantId, platform: "meta", adAccountId: "act_1", displayName: "Acme", externalRef: "oc_conn_1" },
    { store, now: fixedNow(T0) },
  );
  if (!r.ok) throw new Error("connect failed");
  return (r.data as { connection: { id: string } }).connection.id;
}

function snap(connectionId: string, tenantId: string, campaignId: string, date: string, over: Partial<InsightSnapshot> = {}): InsightSnapshot {
  return {
    id: `snap_${connectionId}_${campaignId}_${date}`,
    connectionId, tenantId, platform: "meta", campaignId, campaignName: campaignId, date,
    spendCents: 10000, impressions: 10000, clicks: 500, conversions: 20, ctr: 5, cpcCents: 20, roas: 2, raw: null,
    createdAt: new Date(T0).toISOString(), ...over,
  };
}

describe("connections", () => {
  it("connect → list → disconnect", async () => {
    const store = createMemoryAdsStore();
    const id = await connect(store);
    const list = await listConnections({ tenantId: "t1" }, { store });
    expect(list.ok && list.data.count).toBe(1);

    const del = await disconnectAccount({ tenantId: "t1", connectionId: id }, { store });
    expect(del.ok).toBe(true);
    if (del.ok) expect(del.data.event?.name).toBe("ad.account_disconnected");

    const after = await listConnections({ tenantId: "t1" }, { store });
    expect(after.ok && after.data.count).toBe(0);
  });

  it("connect emits ad.account_connected with correlationId", async () => {
    const store = createMemoryAdsStore();
    const r = await connectAccount(
      { tenantId: "t1", platform: "meta", adAccountId: "act_1", externalRef: "oc_1" },
      { store, correlationId: "corr-1" },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.event?.name).toBe("ad.account_connected");
      expect(r.data.event?.correlationId).toBe("corr-1");
      expect(r.meta.source).toBe("ads-manager");
    }
  });
});

describe("entitlement gate ($1.90/mo)", () => {
  it("blocks listCampaigns with 402 when not subscribed", async () => {
    const store = createMemoryAdsStore();
    const id = await connect(store);
    const r = await listCampaigns(
      { tenantId: "t1", connectionId: id, since: "2026-06-01", until: "2026-06-10" },
      { store, connector: createMemoryConnector(), entitlement: createMemoryEntitlement(false) },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(402);
      expect(r.error.code).toBe("ads.NOT_ENTITLED");
    }
  });

  it("allows listCampaigns when subscribed", async () => {
    const store = createMemoryAdsStore();
    const id = await connect(store);
    const r = await listCampaigns(
      { tenantId: "t1", connectionId: id, since: "2026-06-01", until: "2026-06-10" },
      { store, connector: createMemoryConnector(), entitlement: createMemoryEntitlement(true) },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.count).toBeGreaterThan(0);
  });
});

describe("syncInsights", () => {
  it("pulls insights and stores snapshots (entitlement-gated)", async () => {
    const store = createMemoryAdsStore();
    const id = await connect(store);
    const r = await syncInsights(
      { tenantId: "t1", connectionId: id, date: "2026-06-10" },
      { store, connector: createMemoryConnector(), entitlement: createMemoryEntitlement(true), now: fixedNow(T0) },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const data = r.data as { synced: number; event?: { name: string } };
      expect(data.synced).toBe(2);
      expect(data.event?.name).toBe("ad.insights_synced");
    }
    const snaps = await store.listSnapshots({ tenantId: "t1" });
    expect(snaps.length).toBe(2);
  });
});

describe("detectAnomalies", () => {
  it("raises spend_spike + zero_conv, and is idempotent (dedup)", async () => {
    const store = createMemoryAdsStore();
    const id = await connect(store);
    const ent = createMemoryEntitlement(true);

    // 7 prior days baseline for c1 (spend 10000, cpc 20); today 3× spend.
    const prior: InsightSnapshot[] = [];
    for (let d = 3; d <= 9; d++) prior.push(snap(id, "t1", "c1", `2026-06-0${d}`));
    await store.upsertSnapshots(prior);
    await store.upsertSnapshots([
      snap(id, "t1", "c1", "2026-06-10", { spendCents: 30000 }), // 3× → spend_spike
      snap(id, "t1", "c2", "2026-06-10", { spendCents: 5000, conversions: 0 }), // zero_conv
    ]);

    const r = await detectAnomalies({ tenantId: "t1", connectionId: id, date: "2026-06-10" }, { store, entitlement: ent, now: fixedNow(T0) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const types = r.data.alerts.map((a) => a.type).sort();
    expect(types).toContain("spend_spike");
    expect(types).toContain("zero_conv");
    expect(r.data.event?.name).toBe("ad.alert_raised");

    // Second run: dedup → no new alerts.
    const again = await detectAnomalies({ tenantId: "t1", connectionId: id, date: "2026-06-10" }, { store, entitlement: ent, now: fixedNow(T0) });
    expect(again.ok && again.data.count).toBe(0);

    const alerts = await listAlerts({ tenantId: "t1" }, { store });
    expect(alerts.ok && alerts.data.count).toBe(types.length);
  });

  it("is entitlement-gated (402)", async () => {
    const store = createMemoryAdsStore();
    const id = await connect(store);
    const r = await detectAnomalies({ tenantId: "t1", connectionId: id, date: "2026-06-10" }, { store, entitlement: createMemoryEntitlement(false) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(402);
  });
});

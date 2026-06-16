import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import {
  connectAccount,
  listConnections,
  listCampaigns,
  detectAnomalies,
  listAlerts,
  snapshotId,
  type InsightSnapshot,
} from "@microservices-sh/ads-manager";
import { authorize } from "@microservices-sh/org-team-rbac";
import { resolveAdsDeps, billingEntitlement, mintAdsToken } from "$lib/server/ads";

// Verify the signed-in user actually belongs to (and may manage) the submitted
// org before any tenant-scoped write. Form `orgId` is never authoritative.
async function gateOrg(locals: App.Locals, orgId: string): Promise<boolean> {
  if (!orgId || !locals.user) return false;
  const r = await authorize(orgId, locals.user.id, "org.manage", { store: locals.rbacStore });
  return r.ok;
}

const today = () => new Date().toISOString().slice(0, 10);
function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ locals, platform, parent }) => {
  if (!locals.user) throw redirect(303, "/login");
  const { activeOrgId } = await parent();
  if (!activeOrgId) throw redirect(303, "/app");

  const ent = await billingEntitlement(locals.billingStore).check(activeOrgId);
  if (!ent.active) {
    return { entitled: false, reason: ent.reason ?? "Subscription required.", connections: [], campaigns: [], alerts: [] };
  }

  const { store, connector } = resolveAdsDeps(platform);
  const entitlement = billingEntitlement(locals.billingStore);
  const connsRes = await listConnections({ tenantId: activeOrgId }, { store });
  const connections = connsRes.ok ? connsRes.data.connections : [];

  let campaigns: unknown[] = [];
  if (connections[0]) {
    // Mint the signed ads.service entitlement the upstream connector forwards.
    // Subject = the org (the billing tenant), so upstream grants/usage key on it.
    const entitlementToken = await mintAdsToken(locals.signingKeyStore, activeOrgId, activeOrgId);
    const camp = await listCampaigns(
      { tenantId: activeOrgId, connectionId: connections[0].id, since: daysAgo(7), until: today() },
      { store, connector, entitlement, entitlementToken },
    );
    if (camp.ok) campaigns = camp.data.campaigns;
  }
  const alertsRes = await listAlerts({ tenantId: activeOrgId }, { store });

  return {
    entitled: true,
    activeOrgId,
    connections: connections.map((c) => ({ id: c.id, platform: c.platform, displayName: c.displayName, adAccountId: c.adAccountId })),
    campaigns,
    alerts: alertsRes.ok ? alertsRes.data.alerts : [],
  };
};

export const actions: Actions = {
  // Connect a demo ad account (real OAuth would happen in the upstream service).
  connect: async ({ locals, platform, request }) => {
    if (!locals.user) return fail(401, { error: "Sign in first." });
    const activeOrgId = String((await request.formData()).get("orgId") ?? "");
    if (!(await gateOrg(locals, activeOrgId))) return fail(403, { error: "You do not have access to this organization." });
    const { store, connector } = resolveAdsDeps(platform);
    const r = await connectAccount(
      { tenantId: activeOrgId, platform: "meta", adAccountId: "act_demo", displayName: "Demo Account", externalRef: `demo_${activeOrgId}` },
      { store },
    );
    if (!r.ok) return fail(r.status, { error: r.error?.message ?? "Connect failed." });

    // Register the grant with the upstream ads service so subsequent reads are
    // authorized (the upstream enforces subject↔connection grants). Best-effort:
    // the dev memory connector has no grantConnection; openclaw may be unreachable.
    try {
      if (connector.grantConnection) {
        const token = await mintAdsToken(locals.signingKeyStore, activeOrgId, activeOrgId);
        const externalRef = (r.data as { connection: { externalRef: string } }).connection.externalRef;
        await connector.grantConnection({ tenantId: activeOrgId, entitlementToken: token }, externalRef);
      }
    } catch { /* upstream grant registration is best-effort */ }
    return { ok: true, connected: true };
  },

  // Demo: seed a baseline + a spike, then run anomaly detection so the monitor
  // and alerts feed populate without a live ad account.
  seedDemo: async ({ locals, platform, request }) => {
    if (!locals.user) return fail(401, { error: "Sign in first." });
    const activeOrgId = String((await request.formData()).get("orgId") ?? "");
    if (!(await gateOrg(locals, activeOrgId))) return fail(403, { error: "You do not have access to this organization." });
    const { store } = resolveAdsDeps(platform);

    const conns = await listConnections({ tenantId: activeOrgId }, { store });
    let connId = conns.ok ? conns.data.connections[0]?.id : undefined;
    if (!connId) {
      const c = await connectAccount(
        { tenantId: activeOrgId, platform: "meta", adAccountId: "act_demo", displayName: "Demo Account", externalRef: `demo_${activeOrgId}` },
        { store },
      );
      if (!c.ok) return fail(c.status, { error: "Connect failed." });
      connId = (c.data as { connection: { id: string } }).connection.id;
    }

    const mk = (campaignId: string, name: string, date: string, spendCents: number, conversions: number): InsightSnapshot => ({
      id: snapshotId(connId!, campaignId, date), connectionId: connId!, tenantId: activeOrgId, platform: "meta",
      campaignId, campaignName: name, date, spendCents, impressions: 10000, clicks: 400, conversions,
      ctr: 4, cpcCents: Math.round(spendCents / 400), roas: 2, raw: null, createdAt: new Date().toISOString(),
    });
    const rows: InsightSnapshot[] = [];
    for (let n = 7; n >= 1; n--) rows.push(mk("c1", "Prospecting", daysAgo(n), 10000, 20)); // baseline
    rows.push(mk("c1", "Prospecting", today(), 30000, 20)); // 3× → spend_spike
    rows.push(mk("c2", "Retargeting", today(), 5000, 0)); // zero_conv
    await store.upsertSnapshots(rows);

    const det = await detectAnomalies({ tenantId: activeOrgId, connectionId: connId, date: today() }, { store, entitlement: billingEntitlement(locals.billingStore) });
    if (!det.ok) return fail(det.status, { error: det.error?.message ?? "Detect failed." });
    return { ok: true, seeded: true, alerts: (det.data as { count: number }).count };
  },
};

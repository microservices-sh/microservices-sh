import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listConnections, connectAccount, disconnectAccount } from "@microservices-sh/ads-manager";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

// Settings hub: ad account connections (configuration) for @microservices-sh/ads-manager.
// This module is a CLIENT of an upstream ads service — it never holds platform
// tokens, only the externalRef the host gets after OAuth there. The alerts/insights
// view lives at /app/ads; account connect/disconnect lives here.
export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("ads-manager", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const connsResult = await listConnections({ tenantId: activeOrgId }, { store: locals.adsStore });

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    connections: connsResult.ok ? connsResult.data.connections : []
  };
};

export const actions: Actions = {
  connect: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const platformId = String(form.get("platform") ?? "") === "google" ? "google" : "meta";
    const adAccountId = String(form.get("adAccountId") ?? "").trim();
    const externalRef = String(form.get("externalRef") ?? "").trim();
    const displayName = String(form.get("displayName") ?? "").trim() || null;
    if (!adAccountId || !externalRef) return fail(400, { error: "Ad account id and upstream connection ref are required." });

    const result = await connectAccount(
      { tenantId: org.id, platform: platformId, adAccountId, externalRef, displayName },
      { store: locals.adsStore }
    );
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not connect the account." });

    await recordEvent(
      { eventName: "ad.account_connected", actorId: locals.user.id, entityType: "ad_connection", entityId: result.data.connection.id, source: "app/ads", payload: { platform: platformId, adAccountId } },
      { auditStore: locals.auditStore }
    );
    return { ok: true, connected: true };
  },

  disconnect: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const connectionId = String((await request.formData()).get("connectionId") ?? "").trim();
    if (!connectionId) return fail(400, { error: "Missing connection." });

    const result = await disconnectAccount({ tenantId: org.id, connectionId }, { store: locals.adsStore });
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not disconnect." });

    await recordEvent(
      { eventName: "ad.account_disconnected", actorId: locals.user.id, entityType: "ad_connection", entityId: connectionId, source: "app/ads", payload: {} },
      { auditStore: locals.auditStore }
    );
    return { ok: true, disconnected: true };
  }
};

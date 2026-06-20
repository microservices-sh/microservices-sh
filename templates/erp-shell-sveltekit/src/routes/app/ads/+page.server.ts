import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listConnections, listAlerts } from "@microservices-sh/ads-manager";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

// Reference UI for @microservices-sh/ads-manager: the anomaly alerts raised
// against the company's connected ad accounts, plus a read-only summary of those
// connections. This module is a CLIENT of an upstream ads service — it never holds
// platform tokens, only the externalRef the host gets after OAuth there. Live
// campaign/insight reads (listCampaigns / getInsights) require the upstream
// connector and are omitted from this sample. Account connect/disconnect
// (configuration) lives in the Settings hub at /app/settings/connections.
export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("ads-manager", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const [connsResult, alertsResult] = await Promise.all([
    listConnections({ tenantId: activeOrgId }, { store: locals.adsStore }),
    listAlerts({ tenantId: activeOrgId }, { store: locals.adsStore })
  ]);

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    connections: connsResult.ok ? connsResult.data.connections : [],
    alerts: alertsResult.ok ? alertsResult.data.alerts : []
  };
};

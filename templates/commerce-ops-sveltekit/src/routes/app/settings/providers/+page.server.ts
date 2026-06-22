import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { parseWooCommerceCredentials, WooCommerceClient } from "@microservices-sh/commerce-sync";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import {
  getEmailProviderHealth,
  getStripeProviderHealth,
  getWooCommerceProviderHealth,
  resolveWooCommerceCredentialsJson,
  sanitizeProviderMessage
} from "$lib/server/provider-health";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform, url }) => {
  requireModule("payment", platform);
  requireModule("commerce-sync", platform);
  requireModule("email", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const ctx = { tenantId: activeOrgId };
  const [connectionsResult, runsResult, receiptsResult] = await Promise.all([
    locals.commerceSyncService.listCommerceConnections(ctx),
    locals.commerceSyncService.listSyncRuns(ctx),
    locals.commerceSyncService.listWebhookReceipts(ctx)
  ]);
  const connections = connectionsResult.ok && connectionsResult.data ? connectionsResult.data : [];
  const runs = runsResult.ok && runsResult.data ? runsResult.data : [];
  const receipts = receiptsResult.ok && receiptsResult.data ? receiptsResult.data : [];
  const woo = getWooCommerceProviderHealth(platform?.env, url, activeOrgId, connections, runs, receipts);

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    providers: [getStripeProviderHealth(platform?.env, url), woo.provider, getEmailProviderHealth(platform?.env)],
    wooConnections: woo.connections
  };
};

export const actions: Actions = {
  testWooCommerceConnection: async ({ request, locals, cookies, platform }) => {
    requireModule("commerce-sync", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const connectionId = text(form.get("connectionId"));
    if (!connectionId) return fail(400, { error: "Choose a WooCommerce connection to test." });

    const connections = await locals.commerceSyncService.listCommerceConnections({ tenantId: org.id, actorId: locals.user.id });
    const connection = connections.ok && connections.data
      ? connections.data.find((item) => item.id === connectionId && item.provider === "woocommerce" && item.active)
      : null;
    if (!connection) return fail(400, { error: "Active WooCommerce connection not found." });
    if (!connection.baseUrl) return fail(400, { error: "WooCommerce connection needs a base URL before testing." });

    const credentials = parseWooCommerceCredentials(resolveWooCommerceCredentialsJson(connection, platform?.env));
    if (!credentials) {
      return fail(400, { error: "WooCommerce credentials are missing. Configure the connection secret reference or default credentials binding." });
    }

    const result = await new WooCommerceClient({
      storeUrl: connection.baseUrl,
      consumerKey: credentials.consumerKey,
      consumerSecret: credentials.consumerSecret
    }).testConnection();

    await recordEvent(
      {
        eventName: "commerce-sync.woocommerce_connection_tested",
        actorId: locals.user.id,
        entityType: "commerce_connection",
        entityId: connection.id,
        source: "app/settings/providers",
        payload: { provider: "woocommerce", success: result.success, storeName: result.storeName ?? null }
      },
      { auditStore: locals.auditStore }
    );

    return {
      wooTested: true,
      test: {
        connectionId: connection.id,
        connectionName: connection.name,
        success: result.success,
        message: sanitizeProviderMessage(result.message),
        storeName: result.storeName ?? null
      }
    };
  }
};

import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { getCommerceSyncModuleStatus } from "@microservices-sh/commerce-sync";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("commerce-sync", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");
  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const service = locals.commerceSyncService;
  const ctx = { tenantId: activeOrgId };
  const [connections, runs, mappings, receipts] = await Promise.all([
    service.listCommerceConnections(ctx),
    service.listSyncRuns(ctx),
    service.listProviderMappings(ctx),
    service.listWebhookReceipts(ctx)
  ]);

  return {
    status: getCommerceSyncModuleStatus(),
    connections: connections.ok ? connections.data : [],
    run: runs.ok ? (runs.data[0] ?? null) : null,
    mapping: mappings.ok ? (mappings.data[0] ?? null) : null,
    webhook: receipts.ok ? (receipts.data[0] ?? null) : null
  };
};

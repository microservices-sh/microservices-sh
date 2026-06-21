import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { createCommerceSyncMemoryService, getCommerceSyncModuleStatus } from "@microservices-sh/commerce-sync";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("commerce-sync", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");
  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const service = createCommerceSyncMemoryService();
  const ctx = { tenantId: activeOrgId, now: "2026-06-21T00:00:00.000Z" };
  const connection = service.createCommerceConnection(ctx, {
    provider: "shopify",
    name: "Shopify primary",
    baseUrl: "https://store.example.com",
    secretRef: "secret://commerce/shopify-primary"
  });
  const run = connection.ok ? service.startSyncRun(ctx, connection.data.id, "product") : null;
  const completedRun = run?.ok
    ? service.completeSyncRun(ctx, run.data.id, {
        processedCount: 128,
        createdCount: 9,
        updatedCount: 41,
        failedCount: 0
      })
    : null;
  const mapping = connection.ok
    ? service.recordProviderMapping(ctx, {
        connectionId: connection.data.id,
        resourceType: "product",
        externalId: "gid://shopify/Product/1001",
        internalId: "catalog-product-demo"
      })
    : null;
  const webhook = connection.ok
    ? service.recordWebhookReceipt(ctx, {
        connectionId: connection.data.id,
        topic: "orders/create",
        idempotencyKey: "demo-orders-create-001",
        signature: "sha256=demo",
        payload: { orderId: "shopify-1001" }
      })
    : null;
  const connections = service.listCommerceConnections(ctx);

  return {
    status: getCommerceSyncModuleStatus(),
    connections: connections.ok ? connections.data : [],
    run: completedRun?.ok ? completedRun.data : null,
    mapping: mapping?.ok ? mapping.data : null,
    webhook: webhook?.ok ? webhook.data : null
  };
};

import { describe, expect, it } from "vitest";
import { createMemoryCommerceSyncStore } from "./adapters/memory-commerce-sync-store";
import { createCommerceSyncMemoryService, createCommerceSyncService } from "./service";

const ctx = { tenantId: "tenant_1", now: "2026-06-21T00:00:00.000Z" };

function sequenceIds() {
  let sequence = 0;
  return (prefix: string) => `${prefix}_${(++sequence).toString().padStart(6, "0")}`;
}

describe("commerce-sync", () => {
  it("preserves the synchronous memory service API", () => {
    const service = createCommerceSyncMemoryService();
    const missingSecret = service.createCommerceConnection(ctx, {
      provider: "woocommerce",
      name: "Store",
      secretRef: ""
    });
    expect(missingSecret.ok).toBe(false);

    const connection = service.createCommerceConnection(ctx, {
      provider: "woocommerce",
      name: "Store",
      baseUrl: "https://example.test",
      secretRef: "secret://commerce/store"
    });
    expect(connection.ok).toBe(true);

    const mapping = service.recordProviderMapping(ctx, {
      connectionId: connection.data!.id,
      resourceType: "order",
      externalId: "1001",
      internalId: "so_1001"
    });
    const replayedMapping = service.recordProviderMapping(ctx, {
      connectionId: connection.data!.id,
      resourceType: "order",
      externalId: "1001",
      internalId: "different"
    });
    expect(replayedMapping.data!.id).toBe(mapping.data!.id);

    const run = service.startSyncRun(ctx, connection.data!.id, "order");
    expect(service.completeSyncRun(ctx, run.data!.id, { processedCount: 2, createdCount: 1, updatedCount: 1, failedCount: 0 }).data!.status).toBe("completed");

    const receipt = service.recordWebhookReceipt(ctx, {
      connectionId: connection.data!.id,
      topic: "order.created",
      idempotencyKey: "delivery-1",
      signature: "sha256=abc",
      payload: { id: 1001 }
    });
    expect(receipt.data!.replayed).toBe(false);
    const replayedReceipt = service.recordWebhookReceipt(ctx, {
      connectionId: connection.data!.id,
      topic: "order.created",
      idempotencyKey: "delivery-1",
      payload: { id: 1001 }
    });
    expect(replayedReceipt.data!.id).toBe(receipt.data!.id);
    expect(replayedReceipt.data!.replayed).toBe(true);

    const envelope = service.normalizeCommercePayload(ctx, {
      connectionId: connection.data!.id,
      resourceType: "order",
      externalId: "1001",
      payload: { total: "12.50" }
    });
    expect(envelope.data!.resourceType).toBe("order");
  });

  it("records commerce state through the store-backed service path", async () => {
    const service = createCommerceSyncService({
      store: createMemoryCommerceSyncStore(),
      idGenerator: sequenceIds()
    });

    const missingSecret = await service.createCommerceConnection(ctx, {
      provider: "shopify",
      name: "Store",
      secretRef: ""
    });
    expect(missingSecret.ok).toBe(false);

    const connection = await service.createCommerceConnection(ctx, {
      provider: "shopify",
      name: "Store",
      baseUrl: "https://shop.example.test",
      secretRef: "secret://commerce/shop"
    });
    expect(connection.ok).toBe(true);

    const list = await service.listCommerceConnections(ctx);
    expect(list.data).toHaveLength(1);
    expect(list.data![0].id).toBe(connection.data!.id);

    const wrongTenant = await service.listCommerceConnections({ ...ctx, tenantId: "tenant_2" });
    expect(wrongTenant.data).toEqual([]);

    const mapping = await service.recordProviderMapping(ctx, {
      connectionId: connection.data!.id,
      resourceType: "product",
      externalId: "sku-1",
      internalId: "prod_1"
    });
    const replayedMapping = await service.recordProviderMapping(ctx, {
      connectionId: connection.data!.id,
      resourceType: "product",
      externalId: "sku-1",
      internalId: "prod_2"
    });
    expect(replayedMapping.data!.id).toBe(mapping.data!.id);
    expect(replayedMapping.data!.internalId).toBe("prod_1");

    const run = await service.startSyncRun(ctx, connection.data!.id, "product");
    const completed = await service.completeSyncRun(ctx, run.data!.id, {
      processedCount: 3,
      createdCount: 2,
      updatedCount: 1,
      failedCount: 0
    });
    expect(completed.data!.status).toBe("completed");
    expect((await service.failSyncRun(ctx, run.data!.id, "late failure")).error!.code).toBe("sync_run_closed");

    const receipt = await service.recordWebhookReceipt(ctx, {
      connectionId: connection.data!.id,
      topic: "products/update",
      idempotencyKey: "delivery-1",
      payload: { id: "sku-1" }
    });
    expect(receipt.data!.replayed).toBe(false);

    const replayedReceipt = await service.recordWebhookReceipt(ctx, {
      connectionId: connection.data!.id,
      topic: "products/update",
      idempotencyKey: "delivery-1",
      payload: { id: "sku-1" }
    });
    expect(replayedReceipt.data!.id).toBe(receipt.data!.id);
    expect(replayedReceipt.data!.replayed).toBe(true);

    const envelope = await service.normalizeCommercePayload(ctx, {
      connectionId: connection.data!.id,
      resourceType: "product",
      externalId: "sku-1",
      payload: { title: "Coffee" }
    });
    expect(envelope.data).toMatchObject({
      tenantId: ctx.tenantId,
      connectionId: connection.data!.id,
      resourceType: "product",
      externalId: "sku-1"
    });
  });
});

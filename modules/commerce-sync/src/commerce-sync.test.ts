import { describe, expect, it } from "vitest";
import { createCommerceSyncMemoryService } from "./service";

const ctx = { tenantId: "tenant_1", now: "2026-06-21T00:00:00.000Z" };

describe("commerce-sync", () => {
  it("records connections, mappings, sync runs, webhook receipts, and normalized payload envelopes", () => {
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
});

import { describe, expect, it } from "vitest";
import { createStorageEntitlementsMemoryStore } from "./adapters/memory";
import { createSequentialStorageEntitlementsIdFactory, createStorageEntitlementsService } from "./service";
import type { ModuleResult, TenantContext } from "./types";

function service() {
  return createStorageEntitlementsService({
    store: createStorageEntitlementsMemoryStore(),
    createId: createSequentialStorageEntitlementsIdFactory(),
    config: { enabled: true, defaultQuotaBytes: 1000, defaultCurrency: "USD" }
  });
}

function unwrap<T>(result: ModuleResult<T>): T {
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "Expected ok result");
  return result.data;
}

const ctx: TenantContext = {
  tenantId: "tenant_1",
  actorId: "user_1",
  now: "2026-01-01T00:00:00.000Z"
};

describe("storage-entitlements service", () => {
  it("reserves quota and releases unused bytes", async () => {
    const storage = service();
    const reserved = unwrap(await storage.reserveStorageBytes(ctx, { ownerType: "user", ownerId: "user_1", sizeBytes: 600 }));
    expect(reserved.usedBytes).toBe(600);

    const rejected = await storage.reserveStorageBytes(ctx, { ownerType: "user", ownerId: "user_1", sizeBytes: 500 });
    expect(rejected.ok).toBe(false);
    expect(rejected.error?.code).toBe("storage_quota_exceeded");

    const released = unwrap(await storage.releaseStorageBytes(ctx, { ownerType: "user", ownerId: "user_1", sizeBytes: 250 }));
    expect(released.usedBytes).toBe(350);

    const floored = unwrap(await storage.releaseStorageBytes(ctx, { ownerType: "user", ownerId: "user_1", sizeBytes: 500 }));
    expect(floored.usedBytes).toBe(0);
  });

  it("keeps legacy file accounting methods as reservation aliases", async () => {
    const storage = service();
    const stored = unwrap(await storage.recordFileStored(ctx, { ownerType: "user", ownerId: "user_1", sizeBytes: 600 }));
    expect(stored.usedBytes).toBe(600);

    const rejected = await storage.recordFileStored(ctx, { ownerType: "user", ownerId: "user_1", sizeBytes: 500 });
    expect(rejected.ok).toBe(false);
    expect(rejected.error?.code).toBe("storage_quota_exceeded");

    const afterDelete = unwrap(await storage.recordFileDeleted(ctx, { ownerType: "user", ownerId: "user_1", sizeBytes: 250 }));
    expect(afterDelete.usedBytes).toBe(350);
  });

  it("completes package purchases idempotently and increases quota once", async () => {
    const storage = service();
    unwrap(await storage.reserveStorageBytes(ctx, { ownerType: "user", ownerId: "user_1", sizeBytes: 600 }));
    const pkg = unwrap(
      await storage.createStoragePackage(ctx, {
        id: "pkg_10gb",
        name: "10 GB",
        storageBytes: 10000,
        priceCents: 900
      })
    );
    expect(pkg.isActive).toBe(true);

    const purchase = unwrap(await storage.createStoragePurchase(ctx, { ownerType: "user", ownerId: "user_1", packageId: "pkg_10gb", externalSessionId: "sess_1" }));
    const completed = unwrap(await storage.completeStoragePurchase(ctx, { externalSessionId: "sess_1", externalPaymentId: "pay_1" }));
    expect(completed.purchase.id).toBe(purchase.id);
    expect(completed.account.quotaBytes).toBe(11000);
    expect(completed.account.usedBytes).toBe(600);

    const again = unwrap(await storage.completeStoragePurchase(ctx, { externalSessionId: "sess_1", externalPaymentId: "pay_1" }));
    expect(again.account.quotaBytes).toBe(11000);
    expect(again.account.usedBytes).toBe(600);
  });

  it("creates expiring share links and records downloads only while active", async () => {
    const storage = service();
    const link = unwrap(
      await storage.createShareLink(ctx, {
        ownerType: "user",
        ownerId: "user_1",
        fileId: "file_1",
        originalName: "proposal.pdf",
        sizeBytes: 300,
        expiryDays: 1,
        shortId: "abc123"
      })
    );
    expect(link.expiresAt).toBe("2026-01-02T00:00:00.000Z");

    const downloaded = unwrap(await storage.recordShareDownload(ctx, "abc123"));
    expect(downloaded.downloadCount).toBe(1);

    const expired = await storage.resolveShareLink({ ...ctx, now: "2026-01-02T00:00:00.000Z" }, "abc123");
    expect(expired.ok).toBe(false);
  });
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createTestD1 } from "@microservices-sh/test-utils";
import { createD1StorageEntitlementsStore } from "./adapters/d1";
import type { StorageAccount } from "./types";

const SCHEMA = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../migrations/0001_initial.sql"), "utf8");
const T0 = "2026-01-01T00:00:00.000Z";

function account(overrides: Partial<StorageAccount> = {}): StorageAccount {
  return {
    id: "stacct_1",
    tenantId: "tenant_1",
    ownerType: "customer",
    ownerId: "customer_1",
    quotaBytes: 1000,
    usedBytes: 0,
    createdAt: T0,
    updatedAt: T0,
    ...overrides
  };
}

describe("D1 storage entitlements store", () => {
  it("reserves bytes with a quota guard and releases them", async () => {
    const { d1 } = createTestD1(SCHEMA);
    const store = createD1StorageEntitlementsStore(d1);

    await store.insertAccountIfMissing(account());
    const reserved = await store.reserveAccountBytes("tenant_1", "customer", "customer_1", 700, T0);
    expect(reserved?.usedBytes).toBe(700);

    const rejected = await store.reserveAccountBytes("tenant_1", "customer", "customer_1", 400, T0);
    expect(rejected).toBeNull();
    expect((await store.getAccount("tenant_1", "customer", "customer_1"))?.usedBytes).toBe(700);

    const released = await store.releaseAccountBytes("tenant_1", "customer", "customer_1", 300, T0);
    expect(released?.usedBytes).toBe(400);
  });

  it("does not overwrite an existing account when ensuring a missing account", async () => {
    const { d1 } = createTestD1(SCHEMA);
    const store = createD1StorageEntitlementsStore(d1);

    await store.insertAccountIfMissing(account());
    await store.reserveAccountBytes("tenant_1", "customer", "customer_1", 700, T0);
    await store.insertAccountIfMissing(account({ id: "stacct_2", quotaBytes: 1, usedBytes: 0 }));

    const existing = await store.getAccount("tenant_1", "customer", "customer_1");
    expect(existing?.id).toBe("stacct_1");
    expect(existing?.quotaBytes).toBe(1000);
    expect(existing?.usedBytes).toBe(700);
  });

  it("adds purchased quota without changing used bytes", async () => {
    const { d1 } = createTestD1(SCHEMA);
    const store = createD1StorageEntitlementsStore(d1);

    await store.insertAccountIfMissing(account({ usedBytes: 500 }));
    const updated = await store.addQuotaBytes("tenant_1", "customer", "customer_1", 250, T0);

    expect(updated?.quotaBytes).toBe(1250);
    expect(updated?.usedBytes).toBe(500);
  });
});

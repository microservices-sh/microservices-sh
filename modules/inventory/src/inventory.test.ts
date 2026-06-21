import { describe, expect, it } from "vitest";
import {
  createMemoryInventoryStore,
  deductStock,
  getStockBalance,
  listStockMovements,
  reconcileStock,
  releaseReservation,
  reserveStock,
  stockIn,
  type ModuleResult
} from "./index";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const fixedNow = (offsetMs = 0) => () => T0 + offsetMs;

function data<T>(result: ModuleResult<T>): T {
  if (!result.ok) throw new Error(`expected ok result, got ${JSON.stringify(result.error)}`);
  return result.data;
}

describe("inventory: stock movements and balances", () => {
  it("calculates stock-in balance from movement rows", async () => {
    const store = createMemoryInventoryStore();

    const received = await stockIn(
      {
        tenantId: "tenant-1",
        productId: "prod-1",
        quantity: 12,
        sourceType: "purchase-order",
        sourceId: "po-1"
      },
      { inventoryStore: store, now: fixedNow() }
    );

    expect(received.status).toBe(201);
    expect(data(received).balance).toMatchObject({ onHand: 12, reserved: 0, available: 12 });

    const balance = await getStockBalance(
      { tenantId: "tenant-1", productId: "prod-1" },
      { inventoryStore: store }
    );
    expect(data(balance).balance).toEqual({
      tenantId: "tenant-1",
      productId: "prod-1",
      locationId: "default",
      onHand: 12,
      reserved: 0,
      available: 12
    });
  });

  it("dedupes reserve and release by source ref", async () => {
    const store = createMemoryInventoryStore();
    await stockIn({ tenantId: "tenant-1", productId: "prod-1", quantity: 10 }, { inventoryStore: store });

    const firstReserve = await reserveStock(
      {
        tenantId: "tenant-1",
        productId: "prod-1",
        quantity: 4,
        sourceType: "order-line",
        sourceId: "line-1"
      },
      { inventoryStore: store, now: fixedNow(1) }
    );
    const secondReserve = await reserveStock(
      {
        tenantId: "tenant-1",
        productId: "prod-1",
        quantity: 4,
        sourceType: "order-line",
        sourceId: "line-1"
      },
      { inventoryStore: store, now: fixedNow(2) }
    );

    expect(data(secondReserve).idempotent).toBe(true);
    expect(data(secondReserve).movement.id).toBe(data(firstReserve).movement.id);
    expect(data(secondReserve).balance).toMatchObject({ onHand: 10, reserved: 4, available: 6 });

    const firstRelease = await releaseReservation(
      {
        tenantId: "tenant-1",
        productId: "prod-1",
        quantity: 4,
        sourceType: "order-line",
        sourceId: "line-1"
      },
      { inventoryStore: store, now: fixedNow(3) }
    );
    const secondRelease = await releaseReservation(
      {
        tenantId: "tenant-1",
        productId: "prod-1",
        quantity: 4,
        sourceType: "order-line",
        sourceId: "line-1"
      },
      { inventoryStore: store, now: fixedNow(4) }
    );

    expect(data(secondRelease).idempotent).toBe(true);
    expect(data(secondRelease).movement.id).toBe(data(firstRelease).movement.id);
    expect(data(secondRelease).balance).toMatchObject({ onHand: 10, reserved: 0, available: 10 });

    const movements = await listStockMovements({ tenantId: "tenant-1", productId: "prod-1" }, { inventoryStore: store });
    const rows = data(movements).movements;
    expect(rows.filter((row) => row.movementType === "reservation")).toHaveLength(1);
    expect(rows.filter((row) => row.movementType === "release")).toHaveLength(1);
  });

  it("dedupes shipment deduction by source ref", async () => {
    const store = createMemoryInventoryStore();
    await stockIn({ tenantId: "tenant-1", productId: "prod-1", quantity: 10 }, { inventoryStore: store });
    await reserveStock(
      {
        tenantId: "tenant-1",
        productId: "prod-1",
        quantity: 4,
        sourceType: "order-line",
        sourceId: "line-2"
      },
      { inventoryStore: store }
    );

    const firstDeduction = await deductStock(
      {
        tenantId: "tenant-1",
        productId: "prod-1",
        quantity: 4,
        consumeReserved: true,
        sourceType: "shipment-line",
        sourceId: "ship-line-1"
      },
      { inventoryStore: store, now: fixedNow(5) }
    );
    const secondDeduction = await deductStock(
      {
        tenantId: "tenant-1",
        productId: "prod-1",
        quantity: 4,
        consumeReserved: true,
        sourceType: "shipment-line",
        sourceId: "ship-line-1"
      },
      { inventoryStore: store, now: fixedNow(6) }
    );

    expect(data(secondDeduction).idempotent).toBe(true);
    expect(data(secondDeduction).movement.id).toBe(data(firstDeduction).movement.id);
    expect(data(secondDeduction).balance).toMatchObject({ onHand: 6, reserved: 0, available: 6 });

    const deductions = await listStockMovements(
      { tenantId: "tenant-1", productId: "prod-1", movementType: "deduction" },
      { inventoryStore: store }
    );
    expect(data(deductions).movements).toHaveLength(1);
  });

  it("rejects insufficient available quantity", async () => {
    const store = createMemoryInventoryStore();
    await stockIn({ tenantId: "tenant-1", productId: "prod-1", quantity: 3 }, { inventoryStore: store });

    const rejected = await reserveStock(
      {
        tenantId: "tenant-1",
        productId: "prod-1",
        quantity: 4,
        sourceType: "order-line",
        sourceId: "line-too-large"
      },
      { inventoryStore: store }
    );

    expect(rejected.ok).toBe(false);
    expect(rejected.status).toBe(409);
    if (!rejected.ok) expect(rejected.error.code).toBe("inventory.INSUFFICIENT_AVAILABLE");
  });

  it("records reconciliation adjustment against the current on-hand count", async () => {
    const store = createMemoryInventoryStore();
    await stockIn({ tenantId: "tenant-1", productId: "prod-1", quantity: 10 }, { inventoryStore: store });

    const firstAdjustment = await reconcileStock(
      {
        tenantId: "tenant-1",
        productId: "prod-1",
        countedQuantity: 7,
        sourceType: "cycle-count",
        sourceId: "count-1",
        reason: "Physical count"
      },
      { inventoryStore: store, now: fixedNow(7) }
    );
    expect(data(firstAdjustment).movement).toMatchObject({
      movementType: "adjustment",
      quantity: 3,
      onHandDelta: -3,
      reservedDelta: 0
    });
    expect(data(firstAdjustment).balance).toMatchObject({ onHand: 7, reserved: 0, available: 7 });

    const duplicateAdjustment = await reconcileStock(
      {
        tenantId: "tenant-1",
        productId: "prod-1",
        countedQuantity: 7,
        sourceType: "cycle-count",
        sourceId: "count-1",
        reason: "Physical count"
      },
      { inventoryStore: store, now: fixedNow(8) }
    );
    expect(data(duplicateAdjustment).idempotent).toBe(true);
    expect(data(duplicateAdjustment).movement.id).toBe(data(firstAdjustment).movement.id);
    expect(data(duplicateAdjustment).balance).toMatchObject({ onHand: 7, reserved: 0, available: 7 });
  });
});

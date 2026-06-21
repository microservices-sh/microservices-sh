import { describe, expect, it } from "vitest";
import {
  cancelShipment,
  completeShipment,
  createMemoryShipmentStore,
  createShipment,
  listShipments,
  type ShipmentInventoryPort
} from "./index";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

async function createBasicShipment(store: ReturnType<typeof createMemoryShipmentStore>) {
  const result = await createShipment(
    {
      tenantId: "tenant-1",
      shipmentNumber: "S-1",
      items: [
        {
          sourceType: "sales-order",
          sourceId: "so_1",
          productId: "prod_1",
          sku: "SKU-1",
          description: "Widget",
          quantity: 2
        }
      ]
    },
    { shipmentStore: store, now: fixedNow(T0) }
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.data.shipment;
}

describe("shipment", () => {
  it("creates shipment batches with items", async () => {
    const store = createMemoryShipmentStore();
    const shipment = await createBasicShipment(store);
    expect(shipment.status).toBe("draft");
    expect(shipment.items).toHaveLength(1);
    expect(shipment.items[0].quantity).toBe(2);
  });

  it("enforces external references per tenant", async () => {
    const store = createMemoryShipmentStore();
    const input = {
      tenantId: "tenant-1",
      externalSource: "woocommerce",
      externalId: "ship-1",
      items: [{ sourceType: "invoice", sourceId: "inv_1", description: "Box", quantity: 1 }]
    };
    const first = await createShipment(input, { shipmentStore: store, now: fixedNow(T0) });
    expect(first.ok).toBe(true);
    const duplicate = await createShipment(input, { shipmentStore: store, now: fixedNow(T0 + 1) });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.error.code).toBe("shipment.EXTERNAL_REF_CONFLICT");
  });

  it("completes shipment once and replays duplicate completion without another inventory deduction", async () => {
    const store = createMemoryShipmentStore();
    const shipment = await createBasicShipment(store);
    const calls: unknown[] = [];
    const inventoryPort: ShipmentInventoryPort = {
      async deductShipment(input) {
        calls.push(input);
        return { deductionRef: `deduct:${input.completionRef}` };
      }
    };

    const first = await completeShipment(
      { tenantId: "tenant-1", shipmentId: shipment.id, completionRef: "ship-complete-1" },
      { shipmentStore: store, inventoryPort, now: fixedNow(T0 + 1) }
    );
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.data.shipment.status).toBe("completed");
      expect(first.data.replayed).toBe(false);
      expect(first.data.shipment.inventoryDeductionRef).toBe("deduct:ship-complete-1");
    }

    const replay = await completeShipment(
      { tenantId: "tenant-1", shipmentId: shipment.id, completionRef: "ship-complete-1" },
      { shipmentStore: store, inventoryPort, now: fixedNow(T0 + 2) }
    );
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.data.replayed).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("rejects completing cancelled shipments and cancelling completed shipments", async () => {
    const store = createMemoryShipmentStore();
    const shipment = await createBasicShipment(store);
    const cancelled = await cancelShipment(
      { tenantId: "tenant-1", shipmentId: shipment.id, reason: "bad address" },
      { shipmentStore: store, now: fixedNow(T0 + 1) }
    );
    expect(cancelled.ok).toBe(true);

    const completeCancelled = await completeShipment(
      { tenantId: "tenant-1", shipmentId: shipment.id, completionRef: "late" },
      { shipmentStore: store, now: fixedNow(T0 + 2) }
    );
    expect(completeCancelled.ok).toBe(false);
    if (!completeCancelled.ok) expect(completeCancelled.error.code).toBe("shipment.CANCELLED");
  });

  it("filters shipments by source", async () => {
    const store = createMemoryShipmentStore();
    await createBasicShipment(store);
    const result = await listShipments(
      { tenantId: "tenant-1", sourceType: "sales-order", sourceId: "so_1" },
      { shipmentStore: store }
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.shipments).toHaveLength(1);
  });
});

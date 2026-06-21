import { describe, expect, it } from "vitest";

import { createMemoryInventoryStore, getStockBalance, stockIn } from "../../modules/inventory/src/index";
import { createMemoryProductCatalogStore, createProduct } from "../../modules/product-catalog/src/index";
import {
  cancelOrder,
  confirmOrder,
  createDraftOrder,
  createMemorySalesOrderStore,
  markOrderInvoiced
} from "../../modules/sales-order/src/index";
import {
  createSalesOrderInventoryReservationPort,
  releaseSalesOrderReservations
} from "../../templates/commerce-ops-sveltekit/src/lib/server/sales-order-inventory.ts";

const T0 = Date.parse("2026-06-21T00:00:00.000Z");
const fixedNow = (offsetMs = 0) => () => T0 + offsetMs;

function mustOk<T>(result: { ok: true; data: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

async function seedProductAndStock(
  productCatalogStore: ReturnType<typeof createMemoryProductCatalogStore>,
  inventoryStore: ReturnType<typeof createMemoryInventoryStore>
) {
  const product = mustOk(
    await createProduct(
      {
        tenantId: "tenant-1",
        sku: "SKU-RESERVE",
        name: "Reserved component",
        priceCents: 1250,
        currency: "USD",
        trackStock: true
      },
      { productCatalogStore, now: fixedNow(1), actor: { id: "user-1" } }
    )
  ).product;

  mustOk(
    await stockIn(
      {
        tenantId: "tenant-1",
        productId: product.id,
        quantity: 10,
        sourceType: "purchase-order",
        sourceId: "po-1"
      },
      { inventoryStore, now: fixedNow(2), actor: { id: "user-1" } }
    )
  );

  return product;
}

async function createTrackedSalesOrder(
  salesOrderStore: ReturnType<typeof createMemorySalesOrderStore>,
  product: { id: string; sku: string; name: string; priceCents: number }
) {
  return mustOk(
    await createDraftOrder(
      {
        tenantId: "tenant-1",
        customerId: "cust-1",
        customerSnapshot: { displayName: "Ada Customer", email: "ada@example.com" },
        currency: "USD",
        lineItems: [
          {
            productId: product.id,
            sku: product.sku,
            name: product.name,
            quantity: 4,
            unitPriceCents: product.priceCents
          }
        ]
      },
      { salesOrderStore, now: fixedNow(3), actor: { id: "user-1" } }
    )
  ).order;
}

describe("commerce sales order inventory lifecycle", () => {
  it("releases tracked-product reservations when a confirmed order is cancelled", async () => {
    const inventoryStore = createMemoryInventoryStore();
    const productCatalogStore = createMemoryProductCatalogStore();
    const salesOrderStore = createMemorySalesOrderStore();
    const product = await seedProductAndStock(productCatalogStore, inventoryStore);
    const draft = await createTrackedSalesOrder(salesOrderStore, product);

    const confirmed = mustOk(
      await confirmOrder(
        { tenantId: draft.tenantId, orderId: draft.id },
        {
          salesOrderStore,
          inventoryReservationPort: createSalesOrderInventoryReservationPort({
            inventoryStore,
            productCatalogStore,
            actorId: "user-1",
            permissions: ["*"],
            now: fixedNow(4)
          }),
          now: fixedNow(4),
          actor: { id: "user-1", permissions: ["*"] }
        }
      )
    ).order;

    expect(confirmed.inventoryReservationId).toBe(`sales-order:${draft.id}`);
    expect(
      mustOk(await getStockBalance({ tenantId: "tenant-1", productId: product.id }, { inventoryStore })).balance
    ).toMatchObject({ onHand: 10, reserved: 4, available: 6 });

    const cancelled = mustOk(
      await cancelOrder(
        { tenantId: confirmed.tenantId, orderId: confirmed.id, reason: "Customer request" },
        { salesOrderStore, now: fixedNow(5), actor: { id: "user-1", permissions: ["*"] } }
      )
    ).order;
    const released = await releaseSalesOrderReservations(cancelled, {
      inventoryStore,
      productCatalogStore,
      actorId: "user-1",
      permissions: ["*"],
      now: fixedNow(6)
    });

    expect(released).toMatchObject({ releasedCount: 1, idempotentCount: 0 });
    expect(
      mustOk(await getStockBalance({ tenantId: "tenant-1", productId: product.id }, { inventoryStore })).balance
    ).toMatchObject({ onHand: 10, reserved: 0, available: 10 });

    const replay = await releaseSalesOrderReservations(cancelled, {
      inventoryStore,
      productCatalogStore,
      actorId: "user-1",
      permissions: ["*"],
      now: fixedNow(7)
    });
    expect(replay).toMatchObject({ releasedCount: 0, idempotentCount: 1 });
  });

  it("releases sales order reservations after invoice handoff", async () => {
    const inventoryStore = createMemoryInventoryStore();
    const productCatalogStore = createMemoryProductCatalogStore();
    const salesOrderStore = createMemorySalesOrderStore();
    const product = await seedProductAndStock(productCatalogStore, inventoryStore);
    const draft = await createTrackedSalesOrder(salesOrderStore, product);

    mustOk(
      await confirmOrder(
        { tenantId: draft.tenantId, orderId: draft.id },
        {
          salesOrderStore,
          inventoryReservationPort: createSalesOrderInventoryReservationPort({
            inventoryStore,
            productCatalogStore,
            actorId: "user-1",
            permissions: ["*"],
            now: fixedNow(8)
          }),
          now: fixedNow(8),
          actor: { id: "user-1", permissions: ["*"] }
        }
      )
    );

    const invoiced = mustOk(
      await markOrderInvoiced(
        { tenantId: draft.tenantId, orderId: draft.id },
        {
          salesOrderStore,
          invoiceDraftPort: {
            async createDraftFromSalesOrder() {
              return { invoiceId: "inv-1", invoiceNumber: "INV-1" };
            }
          },
          now: fixedNow(9),
          actor: { id: "user-1", permissions: ["*"] }
        }
      )
    ).order;
    const released = await releaseSalesOrderReservations(invoiced, {
      inventoryStore,
      productCatalogStore,
      actorId: "user-1",
      permissions: ["*"],
      now: fixedNow(10)
    });

    expect(invoiced).toMatchObject({ status: "invoiced", invoiceId: "inv-1" });
    expect(released).toMatchObject({ releasedCount: 1, idempotentCount: 0 });
    expect(
      mustOk(await getStockBalance({ tenantId: "tenant-1", productId: product.id }, { inventoryStore })).balance
    ).toMatchObject({ onHand: 10, reserved: 0, available: 10 });
  });
});

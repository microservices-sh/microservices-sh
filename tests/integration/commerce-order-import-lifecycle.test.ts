import { describe, expect, it } from "vitest";

import { createMemoryCustomerRepository } from "../../modules/customer/src/adapters/memory-customer-repository";
import { createCommerceSyncService, createMemoryCommerceSyncStore } from "../../modules/commerce-sync/src/index";
import { createMemoryInventoryStore, getStockBalance, stockIn } from "../../modules/inventory/src/index";
import { createMemoryProductCatalogStore, createProduct } from "../../modules/product-catalog/src/index";
import { createMemorySalesOrderStore } from "../../modules/sales-order/src/index";
import { importWooCommerceOrderEnvelope } from "../../templates/commerce-ops-sveltekit/src/lib/server/commerce-order-import.ts";

const tenantId = "tenant-woo-import";
const ctx = { tenantId, actorId: "test", now: "2026-06-21T00:00:00.000Z" };

function sequenceIds() {
  let sequence = 0;
  return (prefix: string) => `${prefix}_${(++sequence).toString().padStart(6, "0")}`;
}

function mustOk<T>(result: { ok: true; data: T } | { ok: false; error?: { message: string } }): T {
  if (!result.ok) throw new Error(result.error?.message ?? "Expected ok result.");
  return result.data;
}

function wooOrderPayload(input: {
  id: number;
  status: string;
  sku: string;
  productId: string | number;
  quantity: number;
}) {
  const lineTotal = (input.quantity * 20).toFixed(2);
  return {
    id: input.id,
    status: input.status,
    currency: "USD",
    customer_id: 12,
    total: lineTotal,
    total_tax: "0.00",
    shipping_total: "0.00",
    discount_total: "0.00",
    billing: {
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.test",
      phone: "+1 555 0100",
      address_1: "1 Algorithm Ave",
      city: "London",
      postcode: "SW1A",
      country: "GB"
    },
    shipping: {},
    line_items: [
      {
        id: 1,
        product_id: input.productId,
        quantity: input.quantity,
        subtotal: lineTotal,
        total: lineTotal,
        price: 20,
        sku: input.sku,
        name: "Imported beans"
      }
    ],
    date_created_gmt: "2026-06-21T09:00:00"
  };
}

describe("WooCommerce order import lifecycle", () => {
  it("maps processing orders to confirmed sales orders and reserves stock", async () => {
    const commerceSyncService = createCommerceSyncService({
      store: createMemoryCommerceSyncStore(),
      idGenerator: sequenceIds()
    });
    const customerRepository = createMemoryCustomerRepository();
    const productCatalogStore = createMemoryProductCatalogStore();
    const inventoryStore = createMemoryInventoryStore();
    const salesOrderStore = createMemorySalesOrderStore();

    const connection = mustOk(
      await commerceSyncService.createCommerceConnection(ctx, {
        provider: "woocommerce",
        name: "Woo Store",
        baseUrl: "https://store.example.test",
        secretRef: "secret://commerce/woo"
      })
    );
    const product = mustOk(
      await createProduct(
        {
          tenantId,
          sku: "COFFEE",
          name: "Imported beans",
          priceCents: 2_000,
          currency: "USD",
          trackStock: true
        },
        { productCatalogStore, actor: { id: "test" } }
      )
    ).product;
    mustOk(
      await stockIn(
        {
          tenantId,
          productId: product.id,
          quantity: 8,
          sourceType: "seed",
          sourceId: "stock-1"
        },
        { inventoryStore, actor: { id: "test" } }
      )
    );

    const envelope = mustOk(
      await commerceSyncService.normalizeCommercePayload(ctx, {
        connectionId: connection.id,
        resourceType: "order",
        externalId: "1001",
        payload: wooOrderPayload({ id: 1001, status: "processing", sku: product.sku, productId: 44, quantity: 3 })
      })
    );
    const imported = await importWooCommerceOrderEnvelope(envelope, {
      commerceSyncService,
      customerRepository,
      productCatalogStore,
      inventoryStore,
      salesOrderStore,
      actor: { id: "woocommerce-sync", permissions: ["inventory.write"] }
    });

    expect(imported).toMatchObject({
      created: true,
      status: "confirmed",
      mappedStatus: "confirmed",
      lineCount: 1
    });
    expect((await salesOrderStore.getOrder(tenantId, imported.orderId))?.status).toBe("confirmed");
    expect(mustOk(await getStockBalance({ tenantId, productId: product.id }, { inventoryStore })).balance).toMatchObject({
      onHand: 8,
      reserved: 3,
      available: 5
    });

    const replayed = await importWooCommerceOrderEnvelope(envelope, {
      commerceSyncService,
      customerRepository,
      productCatalogStore,
      inventoryStore,
      salesOrderStore,
      actor: { id: "woocommerce-sync", permissions: ["inventory.write"] }
    });
    expect(replayed).toMatchObject({ created: false, status: "confirmed" });
    expect(mustOk(await getStockBalance({ tenantId, productId: product.id }, { inventoryStore })).balance).toMatchObject({
      onHand: 8,
      reserved: 3,
      available: 5
    });
  });

  it("maps cancelled WooCommerce orders to cancelled sales orders", async () => {
    const commerceSyncService = createCommerceSyncService({
      store: createMemoryCommerceSyncStore(),
      idGenerator: sequenceIds()
    });
    const customerRepository = createMemoryCustomerRepository();
    const productCatalogStore = createMemoryProductCatalogStore();
    const inventoryStore = createMemoryInventoryStore();
    const salesOrderStore = createMemorySalesOrderStore();

    const connection = mustOk(
      await commerceSyncService.createCommerceConnection(ctx, {
        provider: "woocommerce",
        name: "Woo Store",
        baseUrl: "https://store.example.test",
        secretRef: "secret://commerce/woo"
      })
    );
    const envelope = mustOk(
      await commerceSyncService.normalizeCommercePayload(ctx, {
        connectionId: connection.id,
        resourceType: "order",
        externalId: "1002",
        payload: wooOrderPayload({ id: 1002, status: "cancelled", sku: "GUEST", productId: 45, quantity: 1 })
      })
    );
    const imported = await importWooCommerceOrderEnvelope(envelope, {
      commerceSyncService,
      customerRepository,
      productCatalogStore,
      inventoryStore,
      salesOrderStore,
      actor: { id: "woocommerce-sync", permissions: ["inventory.write"] }
    });

    expect(imported).toMatchObject({
      created: true,
      status: "cancelled",
      mappedStatus: "cancelled",
      lineCount: 1
    });
    const stored = await salesOrderStore.getOrder(tenantId, imported.orderId);
    expect(stored).toMatchObject({
      status: "cancelled",
      cancelReason: "WooCommerce status cancelled"
    });
  });
});

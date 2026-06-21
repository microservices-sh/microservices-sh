import { describe, expect, it } from "vitest";
import { createMemoryCommerceSyncStore } from "./adapters/memory-commerce-sync-store";
import { createCommerceSyncMemoryService, createCommerceSyncService, verifyWooCommerceWebhookSignature } from "./service";

const ctx = { tenantId: "tenant_1", now: "2026-06-21T00:00:00.000Z" };

function sequenceIds() {
  let sequence = 0;
  return (prefix: string) => `${prefix}_${(++sequence).toString().padStart(6, "0")}`;
}

async function signWebhookPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
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
    expect(service.listProviderMappings(ctx).data).toHaveLength(1);

    const run = service.startSyncRun(ctx, connection.data!.id, "order");
    expect(service.completeSyncRun(ctx, run.data!.id, { processedCount: 2, createdCount: 1, updatedCount: 1, failedCount: 0 }).data!.status).toBe("completed");
    expect(service.listSyncRuns(ctx).data).toHaveLength(1);

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
    expect(service.listWebhookReceipts(ctx).data).toHaveLength(1);

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
    expect((await service.listProviderMappings(ctx)).data).toHaveLength(1);

    const run = await service.startSyncRun(ctx, connection.data!.id, "product");
    const completed = await service.completeSyncRun(ctx, run.data!.id, {
      processedCount: 3,
      createdCount: 2,
      updatedCount: 1,
      failedCount: 0
    });
    expect(completed.data!.status).toBe("completed");
    expect((await service.failSyncRun(ctx, run.data!.id, "late failure")).error!.code).toBe("sync_run_closed");
    expect((await service.listSyncRuns(ctx)).data).toHaveLength(1);

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
    expect((await service.listWebhookReceipts(ctx)).data).toHaveLength(1);

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

  it("normalizes WooCommerce customer, product, and order envelopes", async () => {
    const service = createCommerceSyncService({
      store: createMemoryCommerceSyncStore(),
      idGenerator: sequenceIds()
    });
    const connection = await service.createCommerceConnection(ctx, {
      provider: "woocommerce",
      name: "Woo Store",
      baseUrl: "https://store.example.test",
      secretRef: "secret://commerce/woo"
    });
    expect(connection.ok).toBe(true);

    const customer = await service.normalizeCommercePayload(ctx, {
      connectionId: connection.data!.id,
      resourceType: "customer",
      externalId: "12",
      payload: {
        id: 12,
        email: "buyer@example.test",
        first_name: "Ada",
        last_name: "Lovelace",
        username: "ada",
        billing: {
          first_name: "Ada",
          last_name: "Lovelace",
          address_1: "1 Algorithm Ave",
          city: "London",
          postcode: "SW1A",
          country: "GB",
          phone: "+44 20"
        },
        shipping: { first_name: "Ada", last_name: "Lovelace", city: "London", country: "GB" },
        date_created_gmt: "2026-06-20T08:00:00"
      }
    });
    expect(customer.data!.payload).toMatchObject({
      provider: "woocommerce",
      resourceType: "customer",
      externalId: "12",
      name: "Ada Lovelace",
      email: "buyer@example.test",
      phone: "+44 20",
      billingAddress: { address1: "1 Algorithm Ave", postalCode: "SW1A" },
      createdAt: "2026-06-20T08:00:00.000Z"
    });

    const product = await service.normalizeCommercePayload(ctx, {
      connectionId: connection.data!.id,
      resourceType: "product",
      externalId: "44",
      payload: {
        id: 44,
        name: "Coffee Beans",
        sku: "",
        price: "12.50",
        regular_price: "15.00",
        sale_price: "12.50",
        short_description: "Roasted beans",
        status: "publish",
        type: "simple",
        categories: [{ id: 9, name: "Beans", slug: "beans" }]
      }
    });
    expect(product.data!.payload).toMatchObject({
      provider: "woocommerce",
      resourceType: "product",
      externalId: "44",
      sku: "WC-44",
      priceCents: 1250,
      regularPriceCents: 1500,
      salePriceCents: 1250,
      active: true,
      categories: [{ externalId: "9", name: "Beans", slug: "beans" }]
    });

    const order = await service.normalizeCommercePayload(ctx, {
      connectionId: connection.data!.id,
      resourceType: "order",
      externalId: "1001",
      payload: {
        id: 1001,
        status: "processing",
        currency: "USD",
        customer_id: 12,
        total: "116.50",
        total_tax: "6.50",
        shipping_total: "10.00",
        discount_total: "5.00",
        billing: {
          first_name: "Ada",
          last_name: "Lovelace",
          email: "buyer@example.test",
          phone: "+44 20",
          address_1: "1 Algorithm Ave",
          city: "London",
          postcode: "SW1A",
          country: "GB"
        },
        shipping: {},
        line_items: [
          { id: 1, product_id: 44, quantity: 2, subtotal: "100.00", total: "100.00", price: 50, sku: "COFFEE", name: "Coffee Beans" }
        ],
        shipping_lines: [{ id: 2, method_title: "Flat rate", method_id: "flat_rate", total: "10.00" }],
        coupon_lines: [{ id: 3, code: "WELCOME", discount: "5.00", discount_tax: "0.00" }],
        date_created_gmt: "2026-06-21T09:00:00"
      }
    });
    expect(order.data!.payload).toMatchObject({
      provider: "woocommerce",
      resourceType: "order",
      externalId: "1001",
      mappedStatus: "confirmed",
      customerExternalId: "12",
      subtotalCents: 11000,
      discountCents: 500,
      taxCents: 650,
      shippingCents: 1000,
      totalCents: 11650,
      lineItems: [{ productExternalId: "44", quantity: 2, unitPriceCents: 5000, totalCents: 10000 }],
      shippingLines: [{ methodTitle: "Flat rate", totalCents: 1000 }],
      couponLines: [{ code: "WELCOME", discountCents: 500 }],
      shippingAddress: { email: "buyer@example.test" },
      createdAt: "2026-06-21T09:00:00.000Z"
    });
  });

  it("verifies WooCommerce webhook signatures", async () => {
    const payload = JSON.stringify({ id: 1001, status: "processing" });
    const secret = "webhook-secret";
    const signature = await signWebhookPayload(payload, secret);

    await expect(verifyWooCommerceWebhookSignature(payload, signature, secret)).resolves.toBe(true);
    await expect(verifyWooCommerceWebhookSignature(`${payload}\n`, signature, secret)).resolves.toBe(false);
    await expect(verifyWooCommerceWebhookSignature(payload, null, secret)).resolves.toBe(false);
  });
});

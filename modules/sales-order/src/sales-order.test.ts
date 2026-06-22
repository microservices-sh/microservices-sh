import { describe, expect, it } from "vitest";
import {
  cancelOrder,
  confirmOrder,
  createDraftOrder,
  createMemorySalesOrderStore,
  markOrderInvoiced,
  sendSalesOrder
} from "./index";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

function draftInput(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: "tenant-1",
    customerId: "cust-1",
    customerSnapshot: {
      displayName: "Ada Customer",
      email: "ada@example.com"
    },
    currency: "usd",
    lineItems: [
      {
        productId: "prod-1",
        sku: "SKU-1",
        name: "First item",
        quantity: 2,
        unitPriceCents: 500,
        discountCents: 100,
        taxCents: 80
      },
      {
        productId: "prod-2",
        sku: "SKU-2",
        name: "Second item",
        quantity: 1,
        unitPriceCents: 1200,
        taxCents: 120
      }
    ],
    ...overrides
  };
}

async function seedDraft(store: ReturnType<typeof createMemorySalesOrderStore>, overrides: Record<string, unknown> = {}) {
  const result = await createDraftOrder(draftInput(overrides), { salesOrderStore: store, now: fixedNow(T0) });
  if (!result.ok) throw new Error(result.error.message);
  return result.data.order;
}

describe("sales-order: create draft", () => {
  it("creates a tenant-scoped draft order with integer-cent totals", async () => {
    const store = createMemorySalesOrderStore();
    const result = await createDraftOrder(draftInput({ externalSource: "stacksuite", externalId: "so-100" }), {
      salesOrderStore: store,
      now: fixedNow(T0)
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.data.order).toMatchObject({
      tenantId: "tenant-1",
      status: "draft",
      currency: "USD",
      customerId: "cust-1",
      externalSource: "stacksuite",
      externalId: "so-100",
      subtotalCents: 2200,
      discountCents: 100,
      taxCents: 200,
      totalCents: 2300
    });
    expect(result.data.order.lineItems.map((line) => line.totalCents)).toEqual([980, 1320]);
  });

  it("enforces external ref uniqueness per tenant", async () => {
    const store = createMemorySalesOrderStore();
    await seedDraft(store, { externalSource: "stacksuite", externalId: "so-dup" });

    const duplicate = await createDraftOrder(draftInput({ externalSource: "stacksuite", externalId: "so-dup" }), {
      salesOrderStore: store,
      now: fixedNow(T0 + 1)
    });
    expect(duplicate).toMatchObject({
      ok: false,
      status: 409,
      error: { code: "sales-order.EXTERNAL_REF_CONFLICT" }
    });

    const otherTenant = await createDraftOrder(
      draftInput({ tenantId: "tenant-2", externalSource: "stacksuite", externalId: "so-dup" }),
      { salesOrderStore: store, now: fixedNow(T0 + 2) }
    );
    expect(otherTenant.ok).toBe(true);
  });
});

describe("sales-order: transitions", () => {
  it("confirms once and does not replay inventory reservation", async () => {
    const store = createMemorySalesOrderStore();
    const draft = await seedDraft(store);
    const reservations: string[] = [];
    const reservationPort = {
      async reserveSalesOrder({ order }: { order: typeof draft }) {
        reservations.push(order.id);
        return { reservationId: "res-1" };
      }
    };

    const first = await confirmOrder(
      { tenantId: draft.tenantId, orderId: draft.id },
      { salesOrderStore: store, inventoryReservationPort: reservationPort, now: fixedNow(T0 + 1) }
    );
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.error.message);
    expect(first.data.idempotent).toBe(false);
    expect(first.data.order.status).toBe("confirmed");
    expect(first.data.order.inventoryReservationId).toBe("res-1");

    const replay = await confirmOrder(
      { tenantId: draft.tenantId, orderId: draft.id },
      { salesOrderStore: store, inventoryReservationPort: reservationPort, now: fixedNow(T0 + 2) }
    );
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.data.idempotent).toBe(true);
    expect(reservations).toEqual([draft.id]);
  });

  it("cancels a confirmed order", async () => {
    const store = createMemorySalesOrderStore();
    const draft = await seedDraft(store);
    const confirmed = await confirmOrder(
      { tenantId: draft.tenantId, orderId: draft.id },
      { salesOrderStore: store, now: fixedNow(T0 + 1) }
    );
    expect(confirmed.ok).toBe(true);

    const cancelled = await cancelOrder(
      { tenantId: draft.tenantId, orderId: draft.id, reason: "Customer request" },
      { salesOrderStore: store, now: fixedNow(T0 + 2) }
    );
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) throw new Error(cancelled.error.message);
    expect(cancelled.data.order.status).toBe("cancelled");
    expect(cancelled.data.order.cancelReason).toBe("Customer request");
  });

  it("rejects invalid status transitions", async () => {
    const store = createMemorySalesOrderStore();
    const draft = await seedDraft(store);
    await cancelOrder({ tenantId: draft.tenantId, orderId: draft.id }, { salesOrderStore: store, now: fixedNow(T0 + 1) });

    const invalid = await confirmOrder(
      { tenantId: draft.tenantId, orderId: draft.id },
      { salesOrderStore: store, now: fixedNow(T0 + 2) }
    );
    expect(invalid).toMatchObject({
      ok: false,
      status: 409,
      error: { code: "sales-order.INVALID_STATUS_TRANSITION" }
    });
  });

  it("marks confirmed orders invoiced through the invoice port once", async () => {
    const store = createMemorySalesOrderStore();
    const draft = await seedDraft(store);
    await confirmOrder({ tenantId: draft.tenantId, orderId: draft.id }, { salesOrderStore: store, now: fixedNow(T0 + 1) });
    const invoiceCalls: string[] = [];
    const invoiceDraftPort = {
      async createDraftFromSalesOrder({ order }: { order: typeof draft }) {
        invoiceCalls.push(order.id);
        return { invoiceId: "inv-1", invoiceNumber: "INV-1" };
      }
    };

    const invoiced = await markOrderInvoiced(
      { tenantId: draft.tenantId, orderId: draft.id },
      { salesOrderStore: store, invoiceDraftPort, now: fixedNow(T0 + 2) }
    );
    expect(invoiced.ok).toBe(true);
    if (!invoiced.ok) throw new Error(invoiced.error.message);
    expect(invoiced.data.order.status).toBe("invoiced");
    expect(invoiced.data.order.invoiceId).toBe("inv-1");

    const replay = await markOrderInvoiced(
      { tenantId: draft.tenantId, orderId: draft.id },
      { salesOrderStore: store, invoiceDraftPort, now: fixedNow(T0 + 3) }
    );
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.data.idempotent).toBe(true);
    expect(invoiceCalls).toEqual([draft.id]);
  });
});

describe("sales-order: send", () => {
  it("sends a non-cancelled order through the delivery port and stores last-send metadata", async () => {
    const store = createMemorySalesOrderStore();
    const draft = await seedDraft(store);
    const deliveries: string[] = [];
    const result = await sendSalesOrder(
      { tenantId: draft.tenantId, orderId: draft.id, idempotencyKey: "send-1" },
      {
        salesOrderStore: store,
        salesOrderDeliveryPort: {
          async sendSalesOrder(request) {
            deliveries.push(request.toEmail);
            return { provider: "test", deliveryId: "eml-1", status: "queued" };
          }
        },
        actor: { id: "agent-1" },
        now: fixedNow(T0 + 1)
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.status).toBe(202);
    expect(result.data.idempotent).toBe(false);
    expect(result.data.attempt).toMatchObject({
      recipientEmail: "ada@example.com",
      provider: "test",
      deliveryId: "eml-1",
      deliveryStatus: "queued",
      idempotencyKey: "send-1",
      createdById: "agent-1"
    });
    expect(result.data.order.lastSentToEmail).toBe("ada@example.com");
    expect(result.data.order.lastEmailDeliveryId).toBe("eml-1");
    expect(deliveries).toEqual(["ada@example.com"]);
  });

  it("does not replay delivery when the idempotency key was already recorded", async () => {
    const store = createMemorySalesOrderStore();
    const draft = await seedDraft(store);
    let deliveryCount = 0;
    const deps = {
      salesOrderStore: store,
      salesOrderDeliveryPort: {
        async sendSalesOrder() {
          deliveryCount += 1;
          return { provider: "test", deliveryId: `eml-${deliveryCount}`, status: "sent" };
        }
      },
      now: fixedNow(T0 + 1)
    };

    const first = await sendSalesOrder({ tenantId: draft.tenantId, orderId: draft.id, idempotencyKey: "same-send" }, deps);
    const second = await sendSalesOrder({ tenantId: draft.tenantId, orderId: draft.id, idempotencyKey: "same-send" }, deps);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.data.idempotent).toBe(true);
      expect(second.data.attempt.deliveryId).toBe("eml-1");
    }
    expect(deliveryCount).toBe(1);
  });

  it("requires a recipient email", async () => {
    const store = createMemorySalesOrderStore();
    const draft = await seedDraft(store, { customerSnapshot: { displayName: "No Email", email: null } });
    const result = await sendSalesOrder(
      { tenantId: draft.tenantId, orderId: draft.id },
      {
        salesOrderStore: store,
        salesOrderDeliveryPort: {
          async sendSalesOrder() {
            return { status: "sent" };
          }
        }
      }
    );
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: { code: "sales-order.RECIPIENT_EMAIL_REQUIRED" }
    });
  });

  it("records failed delivery attempts and returns a gateway error", async () => {
    const store = createMemorySalesOrderStore();
    const draft = await seedDraft(store);
    const result = await sendSalesOrder(
      { tenantId: draft.tenantId, orderId: draft.id },
      {
        salesOrderStore: store,
        salesOrderDeliveryPort: {
          async sendSalesOrder() {
            return { provider: "test", status: "failed", errorMessage: "Provider rejected the message." };
          }
        },
        now: fixedNow(T0 + 1)
      }
    );
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      error: { code: "sales-order.DELIVERY_FAILED" }
    });
    const updated = await store.getOrder(draft.tenantId, draft.id);
    expect(updated?.lastSendStatus).toBe("failed");
  });
});

import { describe, it, expect } from "vitest";
import {
  createInvoice,
  createInvoicePaymentLink,
  createStripeInvoicePaymentLinkProvider,
  addLineItem,
  issueInvoice,
  recordPayment,
  voidInvoice,
  createMemoryInvoiceStore,
  createMemoryNumberAllocator
} from "./index";
import type { InvoicePaymentLinkProvider } from "./index";

const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

function createPaymentLinkProvider() {
  const calls: Parameters<InvoicePaymentLinkProvider["createPaymentLink"]>[0][] = [];
  const provider: InvoicePaymentLinkProvider = {
    async createPaymentLink(input) {
      calls.push(input);
      return {
        id: `plink_${calls.length}`,
        url: `https://pay.example/${input.invoiceId}`,
        provider: "stripe"
      };
    }
  };
  return {
    calls,
    provider
  };
}

async function makeDraftWithLine(invoiceStore: ReturnType<typeof createMemoryInvoiceStore>) {
  const created = await createInvoice(
    {
      tenantId: "tenant-1",
      customerId: "cust-1",
      lineItems: [{ description: "Service", quantity: 1, unitAmountCents: 10_000, taxRateBps: 0 }]
    },
    { invoiceStore, now: fixedNow(T0) }
  );
  if (!created.ok) throw new Error("createInvoice failed in fixture");
  return created.data.id as string;
}

describe("invoice: sequential numbering via atomic allocator", () => {
  it("issues two invoices with sequential numbers", async () => {
    const invoiceStore = createMemoryInvoiceStore();
    const allocator = createMemoryNumberAllocator();

    const id1 = await makeDraftWithLine(invoiceStore);
    const id2 = await makeDraftWithLine(invoiceStore);

    const issued1 = await issueInvoice({ invoiceId: id1 }, { invoiceStore, allocator, now: fixedNow(T0) });
    const issued2 = await issueInvoice({ invoiceId: id2 }, { invoiceStore, allocator, now: fixedNow(T0) });

    if (issued1.ok) expect(issued1.data.number).toBe("INV-00001");
    if (issued2.ok) expect(issued2.data.number).toBe("INV-00002");
  });
});

describe("invoice: draft edit after issue is rejected", () => {
  it("rejects addLineItem on an issued (open) invoice", async () => {
    const invoiceStore = createMemoryInvoiceStore();
    const allocator = createMemoryNumberAllocator();

    const id = await makeDraftWithLine(invoiceStore);
    const issued = await issueInvoice({ invoiceId: id }, { invoiceStore, allocator, now: fixedNow(T0) });
    if (issued.ok) expect(issued.data.status).toBe("open");

    const edit = await addLineItem(
      id,
      { description: "Extra", quantity: 1, unitAmountCents: 500, taxRateBps: 0 },
      { invoiceStore, now: fixedNow(T0 + 1) }
    );
    expect(edit.ok).toBe(false);
    expect(edit.status).toBe(409);
    if (!edit.ok) expect(edit.error.code).toBe("invoice.INVOICE_NOT_EDITABLE");
  });
});

describe("invoice: recordPayment idempotency", () => {
  it("applies a payment with the same idempotencyKey exactly once", async () => {
    const invoiceStore = createMemoryInvoiceStore();
    const allocator = createMemoryNumberAllocator();

    const id = await makeDraftWithLine(invoiceStore); // total 10_000
    await issueInvoice({ invoiceId: id }, { invoiceStore, allocator, now: fixedNow(T0) });

    const first = await recordPayment(
      { invoiceId: id, amountCents: 4_000, idempotencyKey: "evt_1" },
      { invoiceStore, now: fixedNow(T0 + 1) }
    );
    if (first.ok) {
      expect(first.data.deduped).toBe(false);
      expect(first.data.amountPaidCents).toBe(4_000);
    }

    const replay = await recordPayment(
      { invoiceId: id, amountCents: 4_000, idempotencyKey: "evt_1" },
      { invoiceStore, now: fixedNow(T0 + 2) }
    );
    if (replay.ok) {
      expect(replay.data.deduped).toBe(true);
      expect(replay.data.amountPaidCents).toBe(4_000); // not double-credited
    }
  });
});

describe("invoice: paid invoice cannot be voided", () => {
  it("rejects voiding a fully-paid invoice", async () => {
    const invoiceStore = createMemoryInvoiceStore();
    const allocator = createMemoryNumberAllocator();

    const id = await makeDraftWithLine(invoiceStore); // total 10_000
    await issueInvoice({ invoiceId: id }, { invoiceStore, allocator, now: fixedNow(T0) });

    const paid = await recordPayment(
      { invoiceId: id, amountCents: 10_000, idempotencyKey: "evt_full" },
      { invoiceStore, now: fixedNow(T0 + 1) }
    );
    if (paid.ok) expect(paid.data.status).toBe("paid");

    const voided = await voidInvoice(id, { invoiceStore, now: fixedNow(T0 + 2) });
    expect(voided.ok).toBe(false);
    expect(voided.status).toBe(409);
    if (!voided.ok) expect(voided.error.code).toBe("invoice.CANNOT_VOID_PAID");
  });
});

describe("invoice: payment links", () => {
  it("creates one payment link for an issued unpaid invoice", async () => {
    const invoiceStore = createMemoryInvoiceStore();
    const allocator = createMemoryNumberAllocator();
    const paymentLinks = createPaymentLinkProvider();

    const id = await makeDraftWithLine(invoiceStore);
    const issued = await issueInvoice({ invoiceId: id }, { invoiceStore, allocator, now: fixedNow(T0) });
    if (!issued.ok) throw new Error("issueInvoice failed in fixture");

    const created = await createInvoicePaymentLink(
      {
        invoiceId: id,
        customerEmail: "billing@example.com",
        successUrl: "https://example.com/invoices/paid"
      },
      { invoiceStore, paymentLinkProvider: paymentLinks.provider, now: fixedNow(T0 + 1) }
    );

    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error(created.error.message);
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      paymentLinkId: "plink_1",
      paymentLinkUrl: `https://pay.example/${id}`,
      provider: "stripe",
      idempotent: false
    });
    expect(paymentLinks.calls[0]).toMatchObject({
      invoiceId: id,
      invoiceNumber: issued.data.number,
      amountCents: 10_000,
      currency: "USD",
      customerId: "cust-1",
      customerEmail: "billing@example.com",
      idempotencyKey: `invoice:${id}:payment-link`
    });

    const replay = await createInvoicePaymentLink(
      { invoiceId: id },
      { invoiceStore, paymentLinkProvider: paymentLinks.provider, now: fixedNow(T0 + 2) }
    );

    expect(replay.ok).toBe(true);
    if (!replay.ok) throw new Error(replay.error.message);
    expect(replay.status).toBe(200);
    expect(replay.data).toMatchObject({ paymentLinkId: "plink_1", idempotent: true });
    expect(paymentLinks.calls).toHaveLength(1);
  });

  it("rejects payment links for draft invoices", async () => {
    const invoiceStore = createMemoryInvoiceStore();
    const paymentLinks = createPaymentLinkProvider();
    const id = await makeDraftWithLine(invoiceStore);

    const result = await createInvoicePaymentLink(
      { invoiceId: id },
      { invoiceStore, paymentLinkProvider: paymentLinks.provider, now: fixedNow(T0 + 1) }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    if (!result.ok) expect(result.error.code).toBe("invoice.INVOICE_NOT_ISSUED");
    expect(paymentLinks.calls).toHaveLength(0);
  });

  it("uses fetch to create Stripe prices and payment links", async () => {
    const requests: Array<{ url: string; body: string; idempotencyKey: string | null }> = [];
    const fetchImpl = (async (url, init) => {
      const headers = new Headers(init?.headers);
      requests.push({
        url: String(url),
        body: String(init?.body ?? ""),
        idempotencyKey: headers.get("Idempotency-Key")
      });
      if (String(url).endsWith("/prices")) {
        return new Response(JSON.stringify({ id: "price_1" }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "plink_1", url: "https://pay.stripe.test/1" }), { status: 200 });
    }) as typeof fetch;
    const provider = createStripeInvoicePaymentLinkProvider("sk_test_123", fetchImpl);

    const link = await provider.createPaymentLink({
      invoiceId: "inv_1",
      invoiceNumber: "INV-00001",
      amountCents: 10_000,
      currency: "USD",
      customerId: "cust-1",
      customerEmail: "billing@example.com",
      description: "Payment for invoice INV-00001",
      successUrl: "https://example.com/success",
      idempotencyKey: "invoice:inv_1:payment-link"
    });

    expect(link).toEqual({ id: "plink_1", url: "https://pay.stripe.test/1", provider: "stripe" });
    expect(requests).toHaveLength(2);
    expect(requests[0].url).toBe("https://api.stripe.com/v1/prices");
    expect(requests[0].idempotencyKey).toBe("invoice:inv_1:payment-link:price");
    expect(new URLSearchParams(requests[0].body).get("unit_amount")).toBe("10000");
    expect(new URLSearchParams(requests[0].body).get("product_data[metadata][invoiceId]")).toBe("inv_1");
    expect(requests[1].url).toBe("https://api.stripe.com/v1/payment_links");
    expect(requests[1].idempotencyKey).toBe("invoice:inv_1:payment-link:payment-link");
    expect(new URLSearchParams(requests[1].body).get("line_items[0][price]")).toBe("price_1");
    expect(new URLSearchParams(requests[1].body).get("after_completion[redirect][url]")).toBe(
      "https://example.com/success"
    );
  });
});

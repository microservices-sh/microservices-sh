import { describe, it, expect } from "vitest";
import {
  createInvoice,
  addLineItem,
  issueInvoice,
  recordPayment,
  voidInvoice,
  createMemoryInvoiceStore,
  createMemoryNumberAllocator
} from "./index";

const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

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

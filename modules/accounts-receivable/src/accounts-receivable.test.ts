import { describe, expect, it } from "vitest";
import {
  createAccountsReceivableMemoryService,
  createAccountsReceivableMemoryStore,
  createAccountsReceivableService,
  createSequentialAccountsReceivableIdFactory
} from "./index";

const ctx = { tenantId: "tenant_1", now: "2026-06-21T00:00:00.000Z" };

describe("accounts-receivable", () => {
  it("records idempotent customer payments, applies them with guards, ages receivables, and creates statements", () => {
    const service = createAccountsReceivableMemoryService();
    service.upsertInvoiceSnapshot(ctx, {
      id: "inv_1",
      customerId: "cus_1",
      invoiceNumber: "INV-1",
      issuedAt: "2026-05-01",
      dueDate: "2026-05-15",
      totalCents: 5000,
      amountPaidCents: 0,
      amountDueCents: 5000,
      status: "open"
    });

    const payment = service.recordCustomerPayment(ctx, {
      customerId: "cus_1",
      amountCents: 3000,
      paymentDate: "2026-06-21",
      idempotencyKey: "stripe:pi_1"
    });
    expect(payment.ok).toBe(true);

    const replay = service.recordCustomerPayment(ctx, {
      customerId: "cus_1",
      amountCents: 3000,
      paymentDate: "2026-06-21",
      idempotencyKey: "stripe:pi_1"
    });
    expect(replay.data!.id).toBe(payment.data!.id);

    const applied = service.applyCustomerPayment(ctx, {
      paymentId: payment.data!.id,
      applications: [{ invoiceId: "inv_1", amountCents: 3000 }]
    });
    expect(applied.ok).toBe(true);

    const overapply = service.applyCustomerPayment(ctx, {
      paymentId: payment.data!.id,
      applications: [{ invoiceId: "inv_1", amountCents: 1 }]
    });
    expect(overapply.ok).toBe(false);
    expect(overapply.error?.code).toBe("payment_overapplied");

    const open = service.listOpenReceivables(ctx);
    expect(open.data![0].amountDueCents).toBe(2000);

    const aging = service.getReceivableAging(ctx, "2026-06-21");
    expect(aging.data!.days31To60Cents).toBe(2000);

    const statement = service.generateCustomerStatement(ctx, "cus_1", "2026-06-21");
    expect(statement.data!.payments).toHaveLength(1);
    expect(statement.data!.applications).toHaveLength(1);
    expect(statement.data!.aging.totalOpenCents).toBe(2000);
  });

  it("runs the durable store-backed service path against the memory store adapter", async () => {
    const store = createAccountsReceivableMemoryStore();
    const createId = createSequentialAccountsReceivableIdFactory();
    const service = createAccountsReceivableService({ store, createId });

    await service.upsertInvoiceSnapshot(ctx, {
      id: "inv_store_1",
      customerId: "cus_store_1",
      invoiceNumber: "INV-STORE-1",
      issuedAt: "2026-05-01",
      dueDate: "2026-05-15",
      totalCents: 7000,
      amountPaidCents: 0,
      amountDueCents: 7000,
      status: "open"
    });

    const payment = await service.recordCustomerPayment(ctx, {
      customerId: "cus_store_1",
      amountCents: 4000,
      paymentDate: "2026-06-21",
      idempotencyKey: "stripe:pi_store_1"
    });
    expect(payment.ok).toBe(true);
    expect(payment.data!.id).toBe("cpay_000001");

    const rehydratedService = createAccountsReceivableService({ store, createId });
    const replay = await rehydratedService.recordCustomerPayment(ctx, {
      customerId: "cus_store_1",
      amountCents: 4000,
      paymentDate: "2026-06-21",
      idempotencyKey: "stripe:pi_store_1"
    });
    expect(replay.data!.id).toBe(payment.data!.id);

    const applied = await rehydratedService.applyCustomerPayment(ctx, {
      paymentId: payment.data!.id,
      applications: [{ invoiceId: "inv_store_1", amountCents: 4000 }]
    });
    expect(applied.ok).toBe(true);
    expect(applied.data!.applications[0].id).toBe("arapp_000001");

    const open = await service.listOpenReceivables(ctx);
    expect(open.data).toEqual([
      expect.objectContaining({
        id: "inv_store_1",
        amountPaidCents: 4000,
        amountDueCents: 3000
      })
    ]);

    const statement = await service.generateCustomerStatement(ctx, "cus_store_1", "2026-06-21");
    expect(statement.data!.payments).toHaveLength(1);
    expect(statement.data!.applications).toHaveLength(1);
    expect(statement.data!.aging.totalOpenCents).toBe(3000);
  });

  it("posts applied customer payments through the accounting poster", async () => {
    const store = createAccountsReceivableMemoryStore();
    const postedRequests: unknown[] = [];
    const service = createAccountsReceivableService({
      store,
      createId: createSequentialAccountsReceivableIdFactory(),
      accountingPoster: {
        async postAccountsReceivablePayment(request) {
          postedRequests.push(request);
          return { journalEntryId: "je_ar_payment_1" };
        }
      }
    });

    await service.upsertInvoiceSnapshot(ctx, {
      id: "inv_posted_1",
      customerId: "cus_posted_1",
      invoiceNumber: "INV-POSTED-1",
      issuedAt: "2026-05-01",
      dueDate: "2026-05-15",
      totalCents: 4000,
      amountPaidCents: 0,
      amountDueCents: 4000,
      status: "open"
    });
    const payment = await service.recordCustomerPayment(ctx, {
      customerId: "cus_posted_1",
      amountCents: 4000,
      currency: "usd",
      paymentMethod: "ach",
      referenceNumber: "ACH-1",
      depositAccountId: "acct_cash",
      paymentDate: "2026-06-21",
      idempotencyKey: "ar:posted:1"
    });

    const applied = await service.applyCustomerPayment(ctx, {
      paymentId: payment.data!.id,
      applications: [{ invoiceId: "inv_posted_1", amountCents: 4000 }]
    });

    expect(applied.ok).toBe(true);
    expect(postedRequests).toHaveLength(1);
    expect(applied.data!.payment).toMatchObject({
      currency: "USD",
      paymentMethod: "ach",
      referenceNumber: "ACH-1",
      depositAccountId: "acct_cash",
      journalEntryId: "je_ar_payment_1",
      postedAt: ctx.now
    });

    const statement = await service.generateCustomerStatement(ctx, "cus_posted_1", "2026-06-21");
    expect(statement.data!.payments[0].journalEntryId).toBe("je_ar_payment_1");
  });

  it("rejects batch applications that over-apply one invoice", () => {
    const service = createAccountsReceivableMemoryService();
    service.upsertInvoiceSnapshot(ctx, {
      id: "inv_batch_1",
      customerId: "cus_batch_1",
      invoiceNumber: "INV-BATCH-1",
      issuedAt: "2026-05-01",
      dueDate: "2026-05-15",
      totalCents: 5000,
      amountPaidCents: 0,
      amountDueCents: 5000,
      status: "open"
    });
    const payment = service.recordCustomerPayment(ctx, {
      customerId: "cus_batch_1",
      amountCents: 6000,
      paymentDate: "2026-06-21",
      idempotencyKey: "stripe:pi_batch_1"
    });

    const result = service.applyCustomerPayment(ctx, {
      paymentId: payment.data!.id,
      applications: [
        { invoiceId: "inv_batch_1", amountCents: 3000 },
        { invoiceId: "inv_batch_1", amountCents: 3000 }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("invoice_overapplied");
    expect(service.listOpenReceivables(ctx).data![0].amountDueCents).toBe(5000);
  });
});

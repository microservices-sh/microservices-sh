import { describe, expect, it } from "vitest";
import { createAccountsReceivableMemoryService } from "./service";

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
});

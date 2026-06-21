import { describe, expect, it } from "vitest";
import {
  createBill,
  createRecurringBillTemplate,
  createMemoryAccountsPayableStore,
  createVendor,
  generateDueRecurringBills,
  getAgingReport,
  listRecurringBillTemplates,
  listVendors,
  markBillPayable,
  recordBillPayment,
  updateRecurringBillTemplateStatus
} from "./index";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

async function seedVendor(
  store: ReturnType<typeof createMemoryAccountsPayableStore>,
  tenantId = "tenant-1"
) {
  const result = await createVendor(
    {
      tenantId,
      name: tenantId === "tenant-1" ? "Acme Supplies" : "Other Vendor",
      email: `${tenantId}@example.com`
    },
    { accountsPayableStore: store, now: fixedNow(T0) }
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.data.vendor;
}

async function seedPayableBill(
  store: ReturnType<typeof createMemoryAccountsPayableStore>,
  overrides: Record<string, unknown> = {}
) {
  const vendor = await seedVendor(store);
  const created = await createBill(
    {
      tenantId: "tenant-1",
      vendorId: vendor.id,
      billDate: "2026-01-01T00:00:00.000Z",
      dueDate: "2026-01-31T00:00:00.000Z",
      lineItems: [{ description: "Paper", quantity: 2, unitAmountCents: 5_000, taxCents: 1_000 }],
      ...overrides
    },
    { accountsPayableStore: store, now: fixedNow(T0) }
  );
  if (!created.ok) throw new Error(created.error.message);
  const payable = await markBillPayable(
    { tenantId: "tenant-1", billId: created.data.bill.id },
    { accountsPayableStore: store, now: fixedNow(T0 + 1) }
  );
  if (!payable.ok) throw new Error(payable.error.message);
  return payable.data.bill;
}

describe("accounts-payable: vendors", () => {
  it("creates and lists vendors within a tenant", async () => {
    const store = createMemoryAccountsPayableStore();
    const vendor = await seedVendor(store, "tenant-1");
    await seedVendor(store, "tenant-2");

    const listed = await listVendors({ tenantId: "tenant-1" }, { accountsPayableStore: store });

    expect(listed.ok).toBe(true);
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.data.vendors).toHaveLength(1);
    expect(listed.data.vendors[0]).toMatchObject({ id: vendor.id, tenantId: "tenant-1", name: "Acme Supplies" });
  });
});

describe("accounts-payable: bills", () => {
  it("creates a bill with integer-cent line totals", async () => {
    const store = createMemoryAccountsPayableStore();
    const vendor = await seedVendor(store);

    const result = await createBill(
      {
        tenantId: "tenant-1",
        vendorId: vendor.id,
        billDate: "2026-01-01T00:00:00.000Z",
        dueDate: "2026-01-31T00:00:00.000Z",
        subtotalCents: 13_000,
        taxCents: 1_000,
        totalCents: 14_000,
        lineItems: [
          { description: "Paper", quantity: 2, unitAmountCents: 5_000, taxCents: 1_000 },
          { description: "Pens", quantity: 1, unitAmountCents: 3_000, taxCents: 0 }
        ]
      },
      { accountsPayableStore: store, now: fixedNow(T0) }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.data.bill).toMatchObject({
      tenantId: "tenant-1",
      vendorId: vendor.id,
      status: "draft",
      subtotalCents: 13_000,
      taxCents: 1_000,
      totalCents: 14_000,
      amountDueCents: 14_000
    });
    expect(result.data.bill.lineItems.map((line) => line.totalCents)).toEqual([11_000, 3_000]);
  });

  it("rejects supplied totals that do not match line totals", async () => {
    const store = createMemoryAccountsPayableStore();
    const vendor = await seedVendor(store);

    const result = await createBill(
      {
        tenantId: "tenant-1",
        vendorId: vendor.id,
        billDate: "2026-01-01T00:00:00.000Z",
        dueDate: "2026-01-31T00:00:00.000Z",
        totalCents: 999,
        lineItems: [{ description: "Paper", quantity: 1, unitAmountCents: 5_000, taxCents: 0 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0) }
    );

    expect(result).toMatchObject({
      ok: false,
      status: 422,
      error: { code: "accounts-payable.BILL_TOTAL_MISMATCH" }
    });
  });

  it("marks a draft bill payable and rejects invalid status transitions", async () => {
    const store = createMemoryAccountsPayableStore();
    const payable = await seedPayableBill(store);
    expect(payable.status).toBe("payable");

    const replay = await markBillPayable(
      { tenantId: "tenant-1", billId: payable.id },
      { accountsPayableStore: store, now: fixedNow(T0 + 2) }
    );
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.data.idempotent).toBe(true);

    const payment = await recordBillPayment(
      {
        tenantId: "tenant-1",
        vendorId: payable.vendorId,
        paymentDate: "2026-01-02T00:00:00.000Z",
        amountCents: 5_000,
        applications: [{ billId: payable.id, amountCents: 5_000 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0 + 3) }
    );
    expect(payment.ok).toBe(true);

    const invalid = await markBillPayable(
      { tenantId: "tenant-1", billId: payable.id },
      { accountsPayableStore: store, now: fixedNow(T0 + 4) }
    );
    expect(invalid).toMatchObject({
      ok: false,
      status: 409,
      error: { code: "accounts-payable.INVALID_STATUS_TRANSITION" }
    });
  });
});

describe("accounts-payable: payments", () => {
  it("applies a payment once per idempotency key", async () => {
    const store = createMemoryAccountsPayableStore();
    const bill = await seedPayableBill(store);

    const first = await recordBillPayment(
      {
        tenantId: "tenant-1",
        vendorId: bill.vendorId,
        paymentDate: "2026-01-02T00:00:00.000Z",
        amountCents: 4_000,
        idempotencyKey: "evt-1",
        applications: [{ billId: bill.id, amountCents: 4_000 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0 + 2) }
    );
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.error.message);
    expect("bills" in first.data).toBe(true);
    if (!("bills" in first.data)) throw new Error("expected fresh payment result");
    const freshPayment = first.data as { bills: Array<{ status: string; amountPaidCents: number; amountDueCents: number }> };
    expect(freshPayment.bills[0]).toMatchObject({ status: "partial", amountPaidCents: 4_000, amountDueCents: 7_000 });

    const replay = await recordBillPayment(
      {
        tenantId: "tenant-1",
        vendorId: bill.vendorId,
        paymentDate: "2026-01-02T00:00:00.000Z",
        amountCents: 4_000,
        idempotencyKey: "evt-1",
        applications: [{ billId: bill.id, amountCents: 4_000 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0 + 3) }
    );
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.data.deduped).toBe(true);
      expect(replay.data.payment.applications).toHaveLength(1);
    }
  });

  it("rejects overpayment above a bill open balance", async () => {
    const store = createMemoryAccountsPayableStore();
    const bill = await seedPayableBill(store);

    const result = await recordBillPayment(
      {
        tenantId: "tenant-1",
        vendorId: bill.vendorId,
        paymentDate: "2026-01-02T00:00:00.000Z",
        amountCents: 12_000,
        applications: [{ billId: bill.id, amountCents: 12_000 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0 + 2) }
    );

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      error: { code: "accounts-payable.OVERPAYMENT" }
    });
  });
});

describe("accounts-payable: aging", () => {
  it("reports open balances by aging bucket", async () => {
    const store = createMemoryAccountsPayableStore();
    const overdue = await seedPayableBill(store, {
      dueDate: "2026-01-10T00:00:00.000Z",
      lineItems: [{ description: "Older bill", quantity: 1, unitAmountCents: 8_000, taxCents: 0 }]
    });
    const current = await seedPayableBill(store, {
      dueDate: "2026-02-20T00:00:00.000Z",
      lineItems: [{ description: "Current bill", quantity: 1, unitAmountCents: 3_000, taxCents: 0 }]
    });

    const report = await getAgingReport(
      { tenantId: "tenant-1", asOfDate: "2026-02-01T00:00:00.000Z" },
      { accountsPayableStore: store }
    );

    expect(report.ok).toBe(true);
    if (!report.ok) throw new Error(report.error.message);
    expect(report.data.report.totals).toMatchObject({
      currentCents: 3_000,
      days1To30Cents: 8_000,
      totalCents: 11_000
    });
    expect(report.data.report.vendors.flatMap((vendor) => vendor.bills).map((bill) => bill.id).sort()).toEqual(
      [current.id, overdue.id].sort()
    );
  });
});

describe("accounts-payable: recurring bill templates", () => {
  it("lists recurring templates by tenant, status, due date, and includes line items", async () => {
    const store = createMemoryAccountsPayableStore();
    const vendor = await seedVendor(store, "tenant-1");
    await seedVendor(store, "tenant-2");

    const dueSoon = await createRecurringBillTemplate(
      {
        tenantId: "tenant-1",
        vendorId: vendor.id,
        name: "Monthly hosting",
        frequency: "monthly",
        startDate: "2026-01-01T00:00:00.000Z",
        lineItems: [{ description: "Hosting", quantity: 1, unitAmountCents: 8_000, taxCents: 0 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0) }
    );
    if (!dueSoon.ok) throw new Error(dueSoon.error.message);

    const future = await createRecurringBillTemplate(
      {
        tenantId: "tenant-1",
        vendorId: vendor.id,
        name: "Annual support",
        frequency: "yearly",
        startDate: "2026-01-01T00:00:00.000Z",
        lineItems: [{ description: "Support", quantity: 1, unitAmountCents: 50_000, taxCents: 0 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0 + 1) }
    );
    if (!future.ok) throw new Error(future.error.message);

    const otherTenantVendor = await seedVendor(store, "tenant-2");
    const otherTenant = await createRecurringBillTemplate(
      {
        tenantId: "tenant-2",
        vendorId: otherTenantVendor.id,
        name: "Other tenant",
        frequency: "monthly",
        startDate: "2026-01-01T00:00:00.000Z",
        lineItems: [{ description: "Other", quantity: 1, unitAmountCents: 1_000, taxCents: 0 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0 + 2) }
    );
    if (!otherTenant.ok) throw new Error(otherTenant.error.message);

    const listed = await listRecurringBillTemplates(
      {
        tenantId: "tenant-1",
        status: "active",
        dueOnOrBefore: "2026-02-01T00:00:00.000Z"
      },
      { accountsPayableStore: store }
    );

    expect(listed.ok).toBe(true);
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.data.count).toBe(1);
    expect(listed.data.templates[0]).toMatchObject({
      id: dueSoon.data.template.id,
      tenantId: "tenant-1",
      name: "Monthly hosting",
      totalCents: 8_000
    });
    expect(listed.data.templates[0].lineItems).toHaveLength(1);
    expect(listed.data.templates[0].lineItems[0]).toMatchObject({ description: "Hosting", totalCents: 8_000 });
  });

  it("updates recurring template status with terminal-state protection", async () => {
    const store = createMemoryAccountsPayableStore();
    const vendor = await seedVendor(store, "tenant-1");
    const created = await createRecurringBillTemplate(
      {
        tenantId: "tenant-1",
        vendorId: vendor.id,
        name: "Monthly hosting",
        frequency: "monthly",
        startDate: "2026-01-01T00:00:00.000Z",
        lineItems: [{ description: "Hosting", quantity: 1, unitAmountCents: 8_000, taxCents: 0 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0) }
    );
    if (!created.ok) throw new Error(created.error.message);

    const paused = await updateRecurringBillTemplateStatus(
      { tenantId: "tenant-1", templateId: created.data.template.id, status: "paused" },
      { accountsPayableStore: store, now: fixedNow(T0 + 1) }
    );
    expect(paused.ok).toBe(true);
    if (!paused.ok) throw new Error(paused.error.message);
    expect(paused.data.template).toMatchObject({ status: "paused", updatedAt: "2026-01-01T00:00:00.001Z" });

    const resumed = await updateRecurringBillTemplateStatus(
      { tenantId: "tenant-1", templateId: created.data.template.id, status: "active" },
      { accountsPayableStore: store, now: fixedNow(T0 + 2) }
    );
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) throw new Error(resumed.error.message);
    expect(resumed.data.template.status).toBe("active");

    const cancelled = await updateRecurringBillTemplateStatus(
      { tenantId: "tenant-1", templateId: created.data.template.id, status: "cancelled" },
      { accountsPayableStore: store, now: fixedNow(T0 + 3) }
    );
    expect(cancelled.ok).toBe(true);

    const invalid = await updateRecurringBillTemplateStatus(
      { tenantId: "tenant-1", templateId: created.data.template.id, status: "active" },
      { accountsPayableStore: store, now: fixedNow(T0 + 4) }
    );
    expect(invalid).toMatchObject({
      ok: false,
      status: 409,
      error: { code: "accounts-payable.INVALID_RECURRING_BILL_TEMPLATE_STATUS_TRANSITION" }
    });
  });

  it("generates due recurring bills and advances templates", async () => {
    const store = createMemoryAccountsPayableStore();
    const vendor = await seedVendor(store, "tenant-1");
    const created = await createRecurringBillTemplate(
      {
        tenantId: "tenant-1",
        vendorId: vendor.id,
        name: "Monthly hosting",
        frequency: "monthly",
        startDate: "2026-01-01T00:00:00.000Z",
        paymentTermsDays: 10,
        maxOccurrences: 1,
        autoMarkPayable: true,
        lineItems: [{ description: "Hosting", quantity: 2, unitAmountCents: 8_000, taxCents: 500 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0) }
    );
    if (!created.ok) throw new Error(created.error.message);

    const generated = await generateDueRecurringBills(
      { tenantId: "tenant-1", asOfDate: "2026-02-01T00:00:00.000Z" },
      { accountsPayableStore: store, now: fixedNow(T0 + 1) }
    );

    expect(generated.ok).toBe(true);
    if (!generated.ok) throw new Error(generated.error.message);
    expect(generated.data.count).toBe(1);
    expect(generated.data.bills[0]).toMatchObject({
      tenantId: "tenant-1",
      vendorId: vendor.id,
      billNumber: expect.stringMatching(/^RB-/),
      status: "payable",
      billDate: "2026-02-01T00:00:00.000Z",
      dueDate: "2026-02-11T00:00:00.000Z",
      recurringTemplateId: created.data.template.id,
      totalCents: 16_500
    });
    expect(generated.data.bills[0].lineItems[0]).toMatchObject({ description: "Hosting", totalCents: 16_500 });

    const templates = await listRecurringBillTemplates(
      { tenantId: "tenant-1", statuses: ["completed"] },
      { accountsPayableStore: store }
    );
    expect(templates.ok).toBe(true);
    if (!templates.ok) throw new Error(templates.error.message);
    expect(templates.data.templates[0]).toMatchObject({
      id: created.data.template.id,
      status: "completed",
      lastBillDate: "2026-02-01T00:00:00.000Z",
      nextBillDate: "2026-03-01T00:00:00.000Z",
      billsGenerated: 1
    });

    const replay = await generateDueRecurringBills(
      { tenantId: "tenant-1", asOfDate: "2026-02-01T00:00:00.000Z" },
      { accountsPayableStore: store, now: fixedNow(T0 + 2) }
    );
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.data.count).toBe(0);
  });
});

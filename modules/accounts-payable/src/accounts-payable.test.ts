import { describe, expect, it } from "vitest";
import {
  createBill,
  createRecurringBillTemplate,
  createMemoryAccountsPayableStore,
  createVendor,
  generateDueRecurringBills,
  getAgingReport,
  get1099VendorReport,
  getBill,
  getBillPayment,
  getRecurringBillTemplate,
  getVendor,
  listBillPayments,
  listBills,
  listRecurringBillTemplates,
  listVendors,
  markBillPayable,
  recordBillPayment,
  updateVendor,
  updateVendorStatus,
  updateRecurringBillTemplateStatus
} from "./index";
import type { BillPayment } from "./index";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

async function seedVendor(
  store: ReturnType<typeof createMemoryAccountsPayableStore>,
  tenantId = "tenant-1",
  overrides: Record<string, unknown> = {}
) {
  const result = await createVendor(
    {
      tenantId,
      name: tenantId === "tenant-1" ? "Acme Supplies" : "Other Vendor",
      email: `${tenantId}@example.com`,
      ...overrides
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

async function seedVendorPayment(
  store: ReturnType<typeof createMemoryAccountsPayableStore>,
  vendorId: string,
  paymentDate: string,
  amountCents: number,
  status: "posted" | "void" = "posted"
) {
  const payment: BillPayment = {
    id: `pay_${paymentDate.replace(/\D/g, "")}_${status}_${amountCents}`,
    tenantId: "tenant-1",
    paymentNumber: `PAY-${amountCents}`,
    vendorId,
    paymentDate,
    amountCents,
    unappliedAmountCents: 0,
    currency: "USD",
    paymentAccountId: "acct-cash",
    paymentMethod: "ach",
    referenceNumber: null,
    memo: null,
    status,
    idempotencyKey: null,
    journalEntryId: null,
    postedAt: status === "posted" ? paymentDate : null,
    voidedAt: status === "void" ? paymentDate : null,
    voidReason: status === "void" ? "Test void" : null,
    createdById: null,
    createdAt: paymentDate,
    updatedAt: paymentDate
  };
  await store.insertPaymentWithApplications({ payment, applications: [], updatedBills: [] });
}

describe("accounts-payable: vendors", () => {
  it("creates and lists vendors within a tenant", async () => {
    const store = createMemoryAccountsPayableStore();
    const vendor = await seedVendor(store, "tenant-1", { defaultExpenseAccountId: "acct-expense-supplies" });
    await seedVendor(store, "tenant-2");

    const listed = await listVendors({ tenantId: "tenant-1" }, { accountsPayableStore: store });

    expect(listed.ok).toBe(true);
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.data.vendors).toHaveLength(1);
    expect(listed.data.vendors[0]).toMatchObject({
      id: vendor.id,
      tenantId: "tenant-1",
      name: "Acme Supplies",
      defaultExpenseAccountId: "acct-expense-supplies"
    });
  });

  it("gets a vendor by tenant and hides foreign tenant vendors", async () => {
    const store = createMemoryAccountsPayableStore();
    const vendor = await seedVendor(store, "tenant-1", {
      taxId: "12-3456789",
      is1099Vendor: true,
      notes: "Requires W-9 review"
    });

    const found = await getVendor({ tenantId: "tenant-1", vendorId: vendor.id }, { accountsPayableStore: store });
    expect(found.ok).toBe(true);
    if (!found.ok) throw new Error(found.error.message);
    expect(found.data.vendor).toMatchObject({
      id: vendor.id,
      tenantId: "tenant-1",
      taxId: "12-3456789",
      is1099Vendor: true,
      notes: "Requires W-9 review"
    });

    const foreign = await getVendor({ tenantId: "tenant-2", vendorId: vendor.id }, { accountsPayableStore: store });
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.status).toBe(404);
  });

  it("updates vendor master fields, guards external reference conflicts, and toggles active state", async () => {
    const store = createMemoryAccountsPayableStore();
    const vendor = await seedVendor(store, "tenant-1", { externalSource: "donor", externalId: "ven-1" });
    await seedVendor(store, "tenant-1", { name: "Conflict Vendor", externalSource: "donor", externalId: "ven-2" });

    const updated = await updateVendor(
      {
        tenantId: "tenant-1",
        vendorId: vendor.id,
        name: "Updated Supplies",
        phone: "+1 555 0101",
        addressLine1: "1 Market St",
        city: "San Francisco",
        state: "CA",
        postalCode: "94105",
        country: "US",
        taxId: "12-3456789",
        is1099Vendor: true,
        defaultPaymentTermsDays: 45,
        currency: "usd",
        notes: "W-9 on file"
      },
      { accountsPayableStore: store, now: fixedNow(T0 + 1) }
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) throw new Error(updated.error.message);
    expect(updated.data.vendor).toMatchObject({
      name: "Updated Supplies",
      phone: "+1 555 0101",
      city: "San Francisco",
      taxId: "12-3456789",
      is1099Vendor: true,
      defaultPaymentTermsDays: 45,
      currency: "USD",
      notes: "W-9 on file"
    });

    const conflict = await updateVendor(
      { tenantId: "tenant-1", vendorId: vendor.id, externalSource: "donor", externalId: "ven-2" },
      { accountsPayableStore: store }
    );
    expect(conflict).toMatchObject({ ok: false, status: 409, error: { code: "accounts-payable.EXTERNAL_VENDOR_CONFLICT" } });

    const deactivated = await updateVendorStatus(
      { tenantId: "tenant-1", vendorId: vendor.id, active: false },
      { accountsPayableStore: store, now: fixedNow(T0 + 2) }
    );
    expect(deactivated.ok).toBe(true);
    if (!deactivated.ok) throw new Error(deactivated.error.message);
    expect(deactivated.data.vendor.active).toBe(false);

    const listed = await listVendors({ tenantId: "tenant-1" }, { accountsPayableStore: store });
    expect(listed.ok).toBe(true);
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.data.vendors.some((item) => item.id === vendor.id)).toBe(false);
  });

  it("reports active 1099 vendor payments by UTC year and excludes void payments", async () => {
    const store = createMemoryAccountsPayableStore();
    const readyVendor = await seedVendor(store, "tenant-1", {
      name: "Ready Contractor",
      taxId: "12-3456789",
      is1099Vendor: true
    });
    const missingTaxVendor = await seedVendor(store, "tenant-1", { name: "Missing Tax", is1099Vendor: true });
    const inactiveVendor = await seedVendor(store, "tenant-1", {
      name: "Inactive Contractor",
      taxId: "98-7654321",
      is1099Vendor: true
    });
    await updateVendorStatus({ tenantId: "tenant-1", vendorId: inactiveVendor.id, active: false }, { accountsPayableStore: store });
    await seedVendor(store, "tenant-1", { name: "Not Reportable", taxId: "11-1111111", is1099Vendor: false });

    await seedVendorPayment(store, readyVendor.id, "2025-12-31T23:59:59.000Z", 900_00);
    await seedVendorPayment(store, readyVendor.id, "2026-01-01T00:00:00.000Z", 1_000_00);
    await seedVendorPayment(store, readyVendor.id, "2026-06-01T00:00:00.000Z", 250_00, "void");
    await seedVendorPayment(store, readyVendor.id, "2027-01-01T00:00:00.000Z", 800_00);
    await seedVendorPayment(store, missingTaxVendor.id, "2026-02-01T00:00:00.000Z", 400_00);
    await seedVendorPayment(store, inactiveVendor.id, "2026-03-01T00:00:00.000Z", 700_00);

    const report = await get1099VendorReport(
      { tenantId: "tenant-1", year: 2026 },
      { accountsPayableStore: store }
    );
    expect(report.ok).toBe(true);
    if (!report.ok) throw new Error(report.error.message);
    expect(report.data.report.totals).toMatchObject({
      vendorCount: 2,
      readyCount: 1,
      missingTaxIdCount: 1,
      totalPaidCents: 1_400_00
    });
    expect(report.data.report.vendors.map((vendor) => vendor.vendorId).sort()).toEqual(
      [readyVendor.id, missingTaxVendor.id].sort()
    );
    expect(report.data.report.vendors.find((vendor) => vendor.vendorId === readyVendor.id)).toMatchObject({
      totalPaidCents: 1_000_00,
      paymentCount: 1,
      readyForReview: true
    });
    expect(report.data.report.vendors.find((vendor) => vendor.vendorId === missingTaxVendor.id)).toMatchObject({
      totalPaidCents: 400_00,
      paymentCount: 1,
      readyForReview: false,
      warnings: ["Missing vendor tax ID"]
    });
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

  it("uses the vendor default expense account for bill lines without an explicit account", async () => {
    const store = createMemoryAccountsPayableStore();
    const vendor = await seedVendor(store, "tenant-1", { defaultExpenseAccountId: "acct-expense-default" });

    const result = await createBill(
      {
        tenantId: "tenant-1",
        vendorId: vendor.id,
        billDate: "2026-01-01T00:00:00.000Z",
        dueDate: "2026-01-31T00:00:00.000Z",
        lineItems: [
          { description: "Defaulted line", quantity: 1, unitAmountCents: 5_000, taxCents: 0 },
          {
            description: "Explicit line",
            quantity: 1,
            unitAmountCents: 3_000,
            taxCents: 0,
            expenseAccountId: "acct-expense-explicit"
          }
        ]
      },
      { accountsPayableStore: store, now: fixedNow(T0) }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.data.bill.lineItems.map((line) => line.expenseAccountId)).toEqual([
      "acct-expense-default",
      "acct-expense-explicit"
    ]);
  });

  it("gets one bill by tenant and includes line items", async () => {
    const store = createMemoryAccountsPayableStore();
    const vendor = await seedVendor(store, "tenant-1");
    const otherTenantVendor = await seedVendor(store, "tenant-2");

    const created = await createBill(
      {
        tenantId: "tenant-1",
        vendorId: vendor.id,
        billDate: "2026-01-01T00:00:00.000Z",
        dueDate: "2026-01-31T00:00:00.000Z",
        lineItems: [{ description: "Paper", quantity: 2, unitAmountCents: 5_000, taxCents: 1_000 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0) }
    );
    if (!created.ok) throw new Error(created.error.message);

    const otherTenant = await createBill(
      {
        tenantId: "tenant-2",
        vendorId: otherTenantVendor.id,
        billDate: "2026-01-01T00:00:00.000Z",
        dueDate: "2026-01-31T00:00:00.000Z",
        lineItems: [{ description: "Other", quantity: 1, unitAmountCents: 1_000, taxCents: 0 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0 + 1) }
    );
    if (!otherTenant.ok) throw new Error(otherTenant.error.message);

    const found = await getBill(
      { tenantId: "tenant-1", billId: created.data.bill.id },
      { accountsPayableStore: store }
    );
    expect(found.ok).toBe(true);
    if (!found.ok) throw new Error(found.error.message);
    expect(found.data.bill).toMatchObject({
      id: created.data.bill.id,
      tenantId: "tenant-1",
      vendorId: vendor.id,
      totalCents: 11_000
    });
    expect(found.data.bill.lineItems).toHaveLength(1);

    const foreign = await getBill(
      { tenantId: "tenant-1", billId: otherTenant.data.bill.id },
      { accountsPayableStore: store }
    );
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.status).toBe(404);
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

  it("applies one payment across multiple bills with partial amounts", async () => {
    const store = createMemoryAccountsPayableStore();
    const vendor = await seedVendor(store);

    const firstCreated = await createBill(
      {
        tenantId: "tenant-1",
        vendorId: vendor.id,
        billDate: "2026-01-01T00:00:00.000Z",
        dueDate: "2026-01-31T00:00:00.000Z",
        lineItems: [{ description: "Hosting", quantity: 1, unitAmountCents: 10_000, taxCents: 0 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0) }
    );
    if (!firstCreated.ok) throw new Error(firstCreated.error.message);
    const secondCreated = await createBill(
      {
        tenantId: "tenant-1",
        vendorId: vendor.id,
        billDate: "2026-01-02T00:00:00.000Z",
        dueDate: "2026-02-01T00:00:00.000Z",
        lineItems: [{ description: "Support", quantity: 1, unitAmountCents: 8_000, taxCents: 0 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0 + 1) }
    );
    if (!secondCreated.ok) throw new Error(secondCreated.error.message);

    for (const billId of [firstCreated.data.bill.id, secondCreated.data.bill.id]) {
      const payable = await markBillPayable(
        { tenantId: "tenant-1", billId },
        { accountsPayableStore: store, now: fixedNow(T0 + 2) }
      );
      if (!payable.ok) throw new Error(payable.error.message);
    }

    const payment = await recordBillPayment(
      {
        tenantId: "tenant-1",
        vendorId: vendor.id,
        paymentDate: "2026-01-05T00:00:00.000Z",
        amountCents: 14_000,
        paymentMethod: "ach",
        referenceNumber: "ACH-42",
        applications: [
          { billId: firstCreated.data.bill.id, amountCents: 10_000 },
          { billId: secondCreated.data.bill.id, amountCents: 4_000 }
        ]
      },
      { accountsPayableStore: store, now: fixedNow(T0 + 3) }
    );

    expect(payment.ok).toBe(true);
    if (!payment.ok) throw new Error(payment.error.message);
    expect("bills" in payment.data).toBe(true);
    if (!("bills" in payment.data)) throw new Error("expected fresh payment result");
    expect(payment.data.payment).toMatchObject({
      amountCents: 14_000,
      unappliedAmountCents: 0,
      paymentMethod: "ach",
      referenceNumber: "ACH-42"
    });
    expect(payment.data.payment.applications).toHaveLength(2);
    const freshPayment = payment.data as {
      payment: {
        id: string;
        amountCents: number;
        unappliedAmountCents: number;
        paymentMethod: string | null;
        referenceNumber: string | null;
        applications: Array<{ billId: string }>;
      };
      bills: Array<{ id: string; status: string; amountDueCents: number }>;
    };
    expect(freshPayment.bills.map((bill) => ({ id: bill.id, status: bill.status, due: bill.amountDueCents }))).toEqual([
      { id: firstCreated.data.bill.id, status: "paid", due: 0 },
      { id: secondCreated.data.bill.id, status: "partial", due: 4_000 }
    ]);

    const found = await getBillPayment(
      { tenantId: "tenant-1", paymentId: freshPayment.payment.id },
      { accountsPayableStore: store }
    );
    expect(found.ok).toBe(true);
    if (!found.ok) throw new Error(found.error.message);
    expect(found.data.payment.applications.map((application) => application.billId).sort()).toEqual(
      [firstCreated.data.bill.id, secondCreated.data.bill.id].sort()
    );

    const billHistory = await listBillPayments(
      { tenantId: "tenant-1", billId: secondCreated.data.bill.id },
      { accountsPayableStore: store }
    );
    expect(billHistory.ok).toBe(true);
    if (!billHistory.ok) throw new Error(billHistory.error.message);
    expect(billHistory.data.payments).toHaveLength(1);
    expect(billHistory.data.payments[0]).toMatchObject({
      id: freshPayment.payment.id,
      tenantId: "tenant-1",
      vendorId: vendor.id,
      amountCents: 14_000
    });

    const foreign = await getBillPayment(
      { tenantId: "tenant-2", paymentId: freshPayment.payment.id },
      { accountsPayableStore: store }
    );
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.status).toBe(404);
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

  it("gets one recurring template by tenant and includes line items", async () => {
    const store = createMemoryAccountsPayableStore();
    const vendor = await seedVendor(store, "tenant-1");
    const otherTenantVendor = await seedVendor(store, "tenant-2");

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

    const otherTenant = await createRecurringBillTemplate(
      {
        tenantId: "tenant-2",
        vendorId: otherTenantVendor.id,
        name: "Other tenant",
        frequency: "monthly",
        startDate: "2026-01-01T00:00:00.000Z",
        lineItems: [{ description: "Other", quantity: 1, unitAmountCents: 1_000, taxCents: 0 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0 + 1) }
    );
    if (!otherTenant.ok) throw new Error(otherTenant.error.message);

    const found = await getRecurringBillTemplate(
      { tenantId: "tenant-1", templateId: created.data.template.id },
      { accountsPayableStore: store }
    );
    expect(found.ok).toBe(true);
    if (!found.ok) throw new Error(found.error.message);
    expect(found.data.template).toMatchObject({
      id: created.data.template.id,
      tenantId: "tenant-1",
      name: "Monthly hosting",
      totalCents: 8_000
    });
    expect(found.data.template.lineItems).toHaveLength(1);

    const foreign = await getRecurringBillTemplate(
      { tenantId: "tenant-1", templateId: otherTenant.data.template.id },
      { accountsPayableStore: store }
    );
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.status).toBe(404);
  });

  it("uses the vendor default expense account for recurring bill lines without an explicit account", async () => {
    const store = createMemoryAccountsPayableStore();
    const vendor = await seedVendor(store, "tenant-1", { defaultExpenseAccountId: "acct-expense-rent" });

    const result = await createRecurringBillTemplate(
      {
        tenantId: "tenant-1",
        name: "Monthly rent",
        vendorId: vendor.id,
        frequency: "monthly",
        startDate: "2026-01-01T00:00:00.000Z",
        lineItems: [{ description: "Rent", quantity: 1, unitAmountCents: 100_000, taxCents: 0 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0) }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.data.template.lineItems[0].expenseAccountId).toBe("acct-expense-rent");
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
    expect(generated.data.createdCount).toBe(1);
    expect(generated.data.dedupedCount).toBe(0);
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

  it("recovers an existing recurring occurrence without duplicating bills", async () => {
    const store = createMemoryAccountsPayableStore();
    const vendor = await seedVendor(store, "tenant-1");
    const template = await createRecurringBillTemplate(
      {
        tenantId: "tenant-1",
        vendorId: vendor.id,
        name: "Monthly hosting",
        frequency: "monthly",
        startDate: "2026-01-01T00:00:00.000Z",
        paymentTermsDays: 10,
        maxOccurrences: 1,
        lineItems: [{ description: "Hosting", quantity: 1, unitAmountCents: 8_000, taxCents: 0 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0) }
    );
    if (!template.ok) throw new Error(template.error.message);

    const existing = await createBill(
      {
        tenantId: "tenant-1",
        vendorId: vendor.id,
        billNumber: "RB-EXISTING-20260201",
        billDate: template.data.template.nextBillDate,
        dueDate: "2026-02-11T00:00:00.000Z",
        recurringTemplateId: template.data.template.id,
        lineItems: [{ description: "Hosting", quantity: 1, unitAmountCents: 8_000, taxCents: 0 }]
      },
      { accountsPayableStore: store, now: fixedNow(T0 + 1) }
    );
    if (!existing.ok) throw new Error(existing.error.message);

    const recovered = await generateDueRecurringBills(
      { tenantId: "tenant-1", asOfDate: "2026-02-01T00:00:00.000Z" },
      { accountsPayableStore: store, now: fixedNow(T0 + 2) }
    );

    expect(recovered.ok).toBe(true);
    if (!recovered.ok) throw new Error(recovered.error.message);
    expect(recovered.status).toBe(200);
    expect(recovered.data).toMatchObject({ count: 1, createdCount: 0, dedupedCount: 1 });
    expect(recovered.data.bills[0].id).toBe(existing.data.bill.id);

    const bills = await listBills({ tenantId: "tenant-1" }, { accountsPayableStore: store });
    expect(bills.ok).toBe(true);
    if (!bills.ok) throw new Error(bills.error.message);
    expect(bills.data.bills.filter((bill) => bill.recurringTemplateId === template.data.template.id)).toHaveLength(1);

    const templates = await listRecurringBillTemplates(
      { tenantId: "tenant-1", statuses: ["completed"] },
      { accountsPayableStore: store }
    );
    expect(templates.ok).toBe(true);
    if (!templates.ok) throw new Error(templates.error.message);
    expect(templates.data.templates[0]).toMatchObject({
      id: template.data.template.id,
      status: "completed",
      lastBillDate: "2026-02-01T00:00:00.000Z",
      billsGenerated: 1
    });
  });
});

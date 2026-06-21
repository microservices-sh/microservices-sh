import { describe, expect, it } from "vitest";
import {
  createInvoice,
  createMemoryInvoiceStore,
  createMemoryNumberAllocator,
  createMemoryRecurringInvoiceStore,
  createRecurringInvoiceTemplate,
  generateDueRecurringInvoices,
  listInvoices,
  listRecurringInvoiceTemplates,
  nextRecurringInvoiceDate,
  updateRecurringInvoiceTemplateStatus
} from "./index";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const TGEN = Date.parse("2026-02-01T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

function templateInput(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: "tenant-1",
    customerId: "cust-1",
    name: "Monthly support",
    frequency: "monthly",
    startAt: "2026-02-01T00:00:00.000Z",
    paymentTermsDays: 10,
    autoIssue: true,
    maxOccurrences: 1,
    lineItems: [{ description: "Support", quantity: 2, unitAmountCents: 5_000, taxRateBps: 500 }],
    ...overrides
  };
}

describe("invoice: recurring invoice templates", () => {
  it("calculates next recurring invoice dates", () => {
    expect(nextRecurringInvoiceDate("2026-02-01T00:00:00.000Z", "weekly")).toBe("2026-02-08T00:00:00.000Z");
    expect(nextRecurringInvoiceDate("2026-02-01T00:00:00.000Z", "monthly")).toBe("2026-03-01T00:00:00.000Z");
    expect(nextRecurringInvoiceDate("2026-02-01T00:00:00.000Z", "quarterly")).toBe("2026-05-01T00:00:00.000Z");
    expect(nextRecurringInvoiceDate("2026-02-01T00:00:00.000Z", "yearly")).toBe("2027-02-01T00:00:00.000Z");
    expect(nextRecurringInvoiceDate("2026-02-01T00:00:00.000Z", "custom", 17)).toBe("2026-02-18T00:00:00.000Z");
  });

  it("creates, lists, and guards recurring template status transitions", async () => {
    const recurringInvoiceStore = createMemoryRecurringInvoiceStore();
    const created = await createRecurringInvoiceTemplate(templateInput({ maxOccurrences: 2 }), {
      recurringInvoiceStore,
      now: fixedNow(T0)
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error(created.error.message);
    expect(created.data.template).toMatchObject({
      tenantId: "tenant-1",
      customerId: "cust-1",
      status: "active",
      nextInvoiceAt: "2026-02-01T00:00:00.000Z",
      totalCents: 10_500
    });

    const listed = await listRecurringInvoiceTemplates(
      { tenantId: "tenant-1", status: "active", dueOnOrBefore: "2026-02-01T00:00:00.000Z" },
      { recurringInvoiceStore }
    );
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.data.templates).toHaveLength(1);

    const paused = await updateRecurringInvoiceTemplateStatus(
      { tenantId: "tenant-1", templateId: created.data.template.id, status: "paused" },
      { recurringInvoiceStore, now: fixedNow(T0 + 1) }
    );
    expect(paused.ok).toBe(true);

    const cancelled = await updateRecurringInvoiceTemplateStatus(
      { tenantId: "tenant-1", templateId: created.data.template.id, status: "cancelled" },
      { recurringInvoiceStore, now: fixedNow(T0 + 2) }
    );
    expect(cancelled.ok).toBe(true);

    const invalid = await updateRecurringInvoiceTemplateStatus(
      { tenantId: "tenant-1", templateId: created.data.template.id, status: "active" },
      { recurringInvoiceStore, now: fixedNow(T0 + 3) }
    );
    expect(invalid.ok).toBe(false);
    expect(invalid.status).toBe(409);
  });

  it("generates due recurring invoices, auto-issues, and completes maxed templates", async () => {
    const invoiceStore = createMemoryInvoiceStore();
    const recurringInvoiceStore = createMemoryRecurringInvoiceStore();
    const allocator = createMemoryNumberAllocator();
    const created = await createRecurringInvoiceTemplate(templateInput(), {
      recurringInvoiceStore,
      now: fixedNow(T0)
    });
    if (!created.ok) throw new Error(created.error.message);

    const generated = await generateDueRecurringInvoices(
      { tenantId: "tenant-1", asOfDate: "2026-02-01T00:00:00.000Z" },
      { invoiceStore, recurringInvoiceStore, allocator, now: fixedNow(TGEN) }
    );

    expect(generated.ok).toBe(true);
    if (!generated.ok) throw new Error(generated.error.message);
    expect(generated.status).toBe(201);
    expect(generated.data).toMatchObject({ count: 1, createdCount: 1, dedupedCount: 0 });
    expect(generated.data.invoices[0]).toMatchObject({
      tenantId: "tenant-1",
      customerId: "cust-1",
      status: "open",
      number: "INV-00001",
      recurringTemplateId: created.data.template.id,
      recurringOccurrenceAt: "2026-02-01T00:00:00.000Z",
      dueAt: "2026-02-11T00:00:00.000Z",
      totalCents: 10_500
    });

    const completed = await listRecurringInvoiceTemplates(
      { tenantId: "tenant-1", statuses: ["completed"] },
      { recurringInvoiceStore }
    );
    expect(completed.ok).toBe(true);
    if (!completed.ok) throw new Error(completed.error.message);
    expect(completed.data.templates[0]).toMatchObject({
      id: created.data.template.id,
      status: "completed",
      lastInvoiceAt: "2026-02-01T00:00:00.000Z",
      nextInvoiceAt: null,
      invoicesGenerated: 1
    });

    const replay = await generateDueRecurringInvoices(
      { tenantId: "tenant-1", asOfDate: "2026-02-01T00:00:00.000Z" },
      { invoiceStore, recurringInvoiceStore, allocator, now: fixedNow(TGEN + 1) }
    );
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.data.count).toBe(0);
  });

  it("recovers an existing occurrence without duplicating invoices", async () => {
    const invoiceStore = createMemoryInvoiceStore();
    const recurringInvoiceStore = createMemoryRecurringInvoiceStore();
    const allocator = createMemoryNumberAllocator();
    const created = await createRecurringInvoiceTemplate(templateInput(), {
      recurringInvoiceStore,
      now: fixedNow(T0)
    });
    if (!created.ok) throw new Error(created.error.message);

    const existing = await createInvoice(
      {
        tenantId: "tenant-1",
        customerId: "cust-1",
        recurringTemplateId: created.data.template.id,
        recurringOccurrenceAt: created.data.template.nextInvoiceAt,
        lineItems: [{ description: "Support", quantity: 2, unitAmountCents: 5_000, taxRateBps: 500 }]
      },
      { invoiceStore, now: fixedNow(T0 + 1) }
    );
    if (!existing.ok) throw new Error(existing.error.message);

    const recovered = await generateDueRecurringInvoices(
      { tenantId: "tenant-1", asOfDate: "2026-02-01T00:00:00.000Z" },
      { invoiceStore, recurringInvoiceStore, allocator, now: fixedNow(TGEN) }
    );

    expect(recovered.ok).toBe(true);
    if (!recovered.ok) throw new Error(recovered.error.message);
    expect(recovered.status).toBe(200);
    expect(recovered.data).toMatchObject({ count: 1, createdCount: 0, dedupedCount: 1 });
    expect(recovered.data.invoices[0]).toMatchObject({ id: existing.data.id, status: "open", number: "INV-00001" });

    const invoices = await listInvoices({ tenantId: "tenant-1" }, { invoiceStore });
    expect(invoices.ok).toBe(true);
    if (invoices.ok) {
      expect(invoices.data.invoices.filter((invoice) => invoice.recurringTemplateId === created.data.template.id)).toHaveLength(1);
    }
  });
});

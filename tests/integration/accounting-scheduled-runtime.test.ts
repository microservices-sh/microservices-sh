import { describe, expect, it } from "vitest";
import {
  createMemoryAccountingCoreStore,
  seedChartOfAccounts,
  seedMonthlyFiscalPeriods
} from "../../modules/accounting-core/src/index.ts";
import {
  createMemoryInvoiceStore,
  createMemoryNumberAllocator,
  createMemoryRecurringInvoiceStore,
  createRecurringInvoiceTemplate
} from "../../modules/invoice/src/index.ts";
import {
  createAccountsReceivableMemoryStore,
  createAccountsReceivableService
} from "../../modules/accounts-receivable/src/index.ts";
import type { Job } from "../../modules/jobs-workflows/src/index.ts";

import { runAccountingScheduled } from "../../templates/accounting-erp-sveltekit/src/lib/server/scheduled.ts";
import {
  createRecurringInvoiceJobHandlers,
  RECURRING_INVOICE_GENERATE_DUE_JOB_TYPE
} from "../../templates/accounting-erp-sveltekit/src/lib/server/recurring-invoice-jobs.ts";

const TENANT_ID = "tenant-recurring";
const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const TGEN = Date.parse("2026-02-01T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

function job(): Job {
  return {
    id: "job_recurring_1",
    type: RECURRING_INVOICE_GENERATE_DUE_JOB_TYPE,
    payload: { tenantId: TENANT_ID },
    status: "running",
    idempotencyKey: null,
    attempts: 1,
    maxAttempts: 3,
    runAt: "2026-02-01T00:00:00.000Z",
    lastError: null,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z"
  };
}

describe("accounting scheduled runtime", () => {
  it("runs schedule catch-up and due job execution through shared module handlers", async () => {
    const result = await runAccountingScheduled(
      { cron: "*/5 * * * *", scheduledTime: Date.parse("2026-06-21T00:00:00.000Z") },
      undefined
    );

    expect(result.scheduled.ok).toBe(true);
    expect(result.ran.ok).toBe(true);
    if (result.scheduled.ok) expect(result.scheduled.data.enqueued).toBeGreaterThanOrEqual(0);
    if (result.ran.ok) expect(result.ran.data.ran).toBeGreaterThanOrEqual(0);
  });

  it("posts and syncs auto-issued recurring invoices through accounting and receivables", async () => {
    const invoiceStore = createMemoryInvoiceStore();
    const recurringInvoiceStore = createMemoryRecurringInvoiceStore();
    const allocator = createMemoryNumberAllocator();
    const accountingCoreStore = createMemoryAccountingCoreStore();
    const accountsReceivableService = createAccountsReceivableService({
      store: createAccountsReceivableMemoryStore()
    });

    const accountingDeps = { accountingCoreStore, now: fixedNow(T0) };
    const chart = await seedChartOfAccounts({ tenantId: TENANT_ID, standard: "gaap", currency: "usd" }, accountingDeps);
    expect(chart.ok).toBe(true);
    const periods = await seedMonthlyFiscalPeriods(
      { tenantId: TENANT_ID, year: 2026, fiscalYearStartMonth: 1 },
      accountingDeps
    );
    expect(periods.ok).toBe(true);

    const template = await createRecurringInvoiceTemplate(
      {
        tenantId: TENANT_ID,
        customerId: "cust-recurring",
        name: "Monthly accounting retainer",
        frequency: "monthly",
        startAt: "2026-02-01T00:00:00.000Z",
        paymentTermsDays: 10,
        autoIssue: true,
        maxOccurrences: 1,
        lineItems: [{ description: "Accounting retainer", quantity: 1, unitAmountCents: 25_000, taxRateBps: 0 }]
      },
      { recurringInvoiceStore, now: fixedNow(T0) }
    );
    expect(template.ok).toBe(true);

    const handlers = createRecurringInvoiceJobHandlers({
      invoiceStore,
      recurringInvoiceStore,
      allocator,
      accountingCoreStore,
      accountsReceivableService,
      actor: { id: "system:test", permissions: ["member.manage"] },
      now: fixedNow(TGEN)
    });

    const result = await handlers[RECURRING_INVOICE_GENERATE_DUE_JOB_TYPE](
      { tenantId: TENANT_ID, asOfDate: "2026-02-01T00:00:00.000Z" },
      job()
    );
    expect(result).toEqual({ ok: true });

    const invoice = (await invoiceStore.list({ tenantId: TENANT_ID }))[0];
    expect(invoice).toMatchObject({ status: "open", number: "INV-00001", totalCents: 25_000 });

    const posted = await accountingCoreStore.findPostedEntryBySourceRef(TENANT_ID, `accounts-receivable:invoice:${invoice.id}`);
    expect(posted).toEqual(expect.objectContaining({ status: "posted", sourceType: "accounts-receivable.invoice" }));

    const receivables = await accountsReceivableService.listOpenReceivables({ tenantId: TENANT_ID, actorId: "system:test" });
    expect(receivables.ok).toBe(true);
    if (!receivables.ok) throw new Error(receivables.error.message);
    expect(receivables.data).toEqual([
      expect.objectContaining({
        id: invoice.id,
        invoiceNumber: "INV-00001",
        totalCents: 25_000,
        amountDueCents: 25_000,
        status: "open"
      })
    ]);
  });
});

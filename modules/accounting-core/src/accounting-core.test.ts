import { describe, expect, it } from "vitest";
import {
  createAccount,
  createFiscalPeriod,
  createJournalEntry,
  createMemoryAccountingCoreStore,
  getTrialBalance,
  postJournalEntry,
  updateJournalEntry,
  voidJournalEntry
} from "./index";

const TENANT_ID = "tenant-1";
const T0 = Date.parse("2026-01-15T12:00:00.000Z");
const fixedNow = (ms = T0) => () => ms;

async function setupLedger(status: "open" | "closed" | "locked" = "open") {
  const store = createMemoryAccountingCoreStore();
  const deps = { accountingCoreStore: store, now: fixedNow() };

  const cash = await createAccount(
    { tenantId: TENANT_ID, code: "1000", name: "Cash", type: "asset" },
    deps
  );
  const revenue = await createAccount(
    { tenantId: TENANT_ID, code: "4000", name: "Sales Revenue", type: "revenue" },
    deps
  );
  const period = await createFiscalPeriod(
    {
      tenantId: TENANT_ID,
      name: "FY2026",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      status
    },
    deps
  );

  if (!cash.ok) throw new Error(cash.error.message);
  if (!revenue.ok) throw new Error(revenue.error.message);
  if (!period.ok) throw new Error(period.error.message);

  return {
    store,
    deps,
    cash: cash.data.account,
    revenue: revenue.data.account,
    period: period.data.period
  };
}

async function createBalancedEntry(
  setup: Awaited<ReturnType<typeof setupLedger>>,
  amountCents = 10_000,
  sourceRef?: string
) {
  const result = await createJournalEntry(
    {
      tenantId: TENANT_ID,
      periodId: setup.period.id,
      entryDate: "2026-01-15",
      description: "Sale",
      sourceRef,
      sourceType: sourceRef ? "invoice" : undefined,
      lines: [
        { accountId: setup.cash.id, debitCents: amountCents },
        { accountId: setup.revenue.id, creditCents: amountCents }
      ]
    },
    setup.deps
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.data.entry;
}

describe("accounting-core: posting", () => {
  it("posts balanced journal entries and freezes posted entries", async () => {
    const setup = await setupLedger();
    const entry = await createBalancedEntry(setup);

    const posted = await postJournalEntry({ tenantId: TENANT_ID, entryId: entry.id }, setup.deps);
    expect(posted.ok).toBe(true);
    if (posted.ok) {
      expect(posted.data.entry.status).toBe("posted");
      expect(posted.data.entry.postedAt).toBe("2026-01-15T12:00:00.000Z");
    }

    const editPosted = await updateJournalEntry(
      { tenantId: TENANT_ID, entryId: entry.id, description: "Edited after posting" },
      setup.deps
    );
    expect(editPosted.ok).toBe(false);
    if (!editPosted.ok) expect(editPosted.error.code).toBe("accounting-core.POSTED_ENTRY_IMMUTABLE");
  });

  it("rejects unbalanced journal entries", async () => {
    const setup = await setupLedger();
    const result = await createJournalEntry(
      {
        tenantId: TENANT_ID,
        periodId: setup.period.id,
        entryDate: "2026-01-15",
        lines: [
          { accountId: setup.cash.id, debitCents: 10_000 },
          { accountId: setup.revenue.id, creditCents: 9_999 }
        ]
      },
      setup.deps
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("accounting-core.JOURNAL_NOT_BALANCED");
  });

  it("rejects posting into closed fiscal periods", async () => {
    const setup = await setupLedger("closed");
    const entry = await createBalancedEntry(setup);

    const posted = await postJournalEntry({ tenantId: TENANT_ID, entryId: entry.id }, setup.deps);
    expect(posted.ok).toBe(false);
    if (!posted.ok) expect(posted.error.code).toBe("accounting-core.FISCAL_PERIOD_CLOSED");
  });

  it("rejects duplicate posted source references per tenant", async () => {
    const setup = await setupLedger();
    const first = await createBalancedEntry(setup, 10_000, "invoice:42");
    const firstPost = await postJournalEntry({ tenantId: TENANT_ID, entryId: first.id }, setup.deps);
    expect(firstPost.ok).toBe(true);

    const second = await createBalancedEntry(setup, 10_000, "invoice:42");
    const duplicate = await postJournalEntry({ tenantId: TENANT_ID, entryId: second.id }, setup.deps);

    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.error.code).toBe("accounting-core.SOURCE_REF_CONFLICT");
  });
});

describe("accounting-core: trial balance and voiding", () => {
  it("calculates trial balance debit and credit totals from posted entries", async () => {
    const setup = await setupLedger();
    const entry = await createBalancedEntry(setup, 12_345);
    const posted = await postJournalEntry({ tenantId: TENANT_ID, entryId: entry.id }, setup.deps);
    expect(posted.ok).toBe(true);

    const trialBalance = await getTrialBalance({ tenantId: TENANT_ID, periodId: setup.period.id }, setup.deps);
    expect(trialBalance.ok).toBe(true);
    if (trialBalance.ok) {
      expect(trialBalance.data.trialBalance.totalDebitCents).toBe(12_345);
      expect(trialBalance.data.trialBalance.totalCreditCents).toBe(12_345);
      expect(trialBalance.data.trialBalance.balanced).toBe(true);
      expect(trialBalance.data.trialBalance.lines).toEqual([
        expect.objectContaining({ accountCode: "1000", debitCents: 12_345, creditCents: 0 }),
        expect.objectContaining({ accountCode: "4000", debitCents: 0, creditCents: 12_345 })
      ]);
    }
  });

  it("voids posted entries by marking the original and posting a reversal entry", async () => {
    const setup = await setupLedger();
    const entry = await createBalancedEntry(setup, 5_000, "invoice:99");
    const posted = await postJournalEntry({ tenantId: TENANT_ID, entryId: entry.id }, setup.deps);
    if (!posted.ok) throw new Error(posted.error.message);

    const voided = await voidJournalEntry(
      { tenantId: TENANT_ID, entryId: entry.id, reason: "Customer refund", voidedById: "actor-1" },
      setup.deps
    );

    expect(voided.ok).toBe(true);
    if (voided.ok) {
      expect(voided.data.entry.status).toBe("void");
      expect(voided.data.entry.reversalEntryId).toBe(voided.data.reversalEntry.id);
      expect(voided.data.reversalEntry.status).toBe("posted");
      expect(voided.data.reversalEntry.reversesEntryId).toBe(entry.id);
      expect(voided.data.reversalEntry.sourceRef).toBe(`void:${entry.id}`);
      expect(voided.data.reversalEntry.lines).toEqual([
        expect.objectContaining({ accountId: setup.cash.id, debitCents: 0, creditCents: 5_000 }),
        expect.objectContaining({ accountId: setup.revenue.id, debitCents: 5_000, creditCents: 0 })
      ]);
    }

    const trialBalance = await getTrialBalance(
      { tenantId: TENANT_ID, periodId: setup.period.id, includeZero: true },
      setup.deps
    );
    expect(trialBalance.ok).toBe(true);
    if (trialBalance.ok) {
      expect(trialBalance.data.trialBalance.totalDebitCents).toBe(0);
      expect(trialBalance.data.trialBalance.totalCreditCents).toBe(0);
      expect(trialBalance.data.trialBalance.lines).toEqual([
        expect.objectContaining({ accountCode: "1000", debitCents: 0, creditCents: 0, balanceCents: 0 }),
        expect.objectContaining({ accountCode: "4000", debitCents: 0, creditCents: 0, balanceCents: 0 })
      ]);
    }

    const secondVoid = await voidJournalEntry({ tenantId: TENANT_ID, entryId: entry.id }, setup.deps);
    expect(secondVoid.ok).toBe(false);
    if (!secondVoid.ok) expect(secondVoid.error.code).toBe("accounting-core.JOURNAL_ENTRY_NOT_VOIDABLE");
  });
});

import { describe, expect, it } from "vitest";
import { createTestD1 } from "@microservices-sh/test-utils";
import {
  createAccount,
  closeFiscalPeriod,
  createD1AccountingCoreStore,
  createFiscalPeriod,
  createJournalEntry,
  createMemoryAccountingCoreStore,
  getAccount,
  getAccountingSetupStatus,
  getFiscalPeriod,
  getGeneralLedger,
  getTrialBalance,
  listFiscalPeriods,
  lockFiscalPeriod,
  postJournalEntry,
  reopenFiscalPeriod,
  seedChartOfAccounts,
  seedMonthlyFiscalPeriods,
  updateAccountingSettings,
  updateFiscalPeriodStatus,
  updateJournalEntry,
  voidJournalEntry,
  type AccountingCoreStore,
  type Account,
  type FiscalPeriod,
  type JournalEntry,
  type JournalLine
} from "./index";

const TENANT_ID = "tenant-1";
const T0 = Date.parse("2026-01-15T12:00:00.000Z");
const fixedNow = (ms = T0) => () => ms;
const D1_FISCAL_PERIOD_SCHEMA = `
CREATE TABLE accounting_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  account_subtype TEXT,
  parent_id TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  normal_balance TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  is_reconcilable INTEGER NOT NULL DEFAULT 0,
  is_header INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE accounting_settings (
  tenant_id TEXT PRIMARY KEY,
  accounting_standard TEXT NOT NULL DEFAULT 'gaap',
  fiscal_year_start_month INTEGER NOT NULL DEFAULT 1,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  default_ar_account_id TEXT,
  default_ap_account_id TEXT,
  default_income_account_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE accounting_fiscal_periods (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'month',
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  closed_by_id TEXT,
  closed_at TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE accounting_journal_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  period_id TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  source_ref TEXT,
  source_type TEXT,
  posted_at TEXT,
  posted_by_id TEXT,
  voided_at TEXT,
  voided_by_id TEXT,
  void_reason TEXT,
  reversal_entry_id TEXT,
  reverses_entry_id TEXT,
  created_by_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE accounting_journal_lines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  description TEXT,
  debit_cents INTEGER NOT NULL DEFAULT 0,
  credit_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE domain_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

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
  sourceRef?: string,
  entryDate = "2026-01-15"
) {
  const result = await createJournalEntry(
    {
      tenantId: TENANT_ID,
      periodId: setup.period.id,
      entryDate,
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
  it("rejects journal lines posted directly to donor-style header accounts", async () => {
    const store = createMemoryAccountingCoreStore();
    const deps = { accountingCoreStore: store, now: fixedNow() };
    const header = await createAccount(
      { tenantId: TENANT_ID, code: "1000", name: "Assets", type: "asset", isHeader: true },
      deps
    );
    const revenue = await createAccount(
      { tenantId: TENANT_ID, code: "4000", name: "Sales Revenue", type: "revenue" },
      deps
    );
    const period = await createFiscalPeriod(
      { tenantId: TENANT_ID, name: "January 2026", startsOn: "2026-01-01", endsOn: "2026-01-31" },
      deps
    );
    if (!header.ok || !revenue.ok || !period.ok) throw new Error("setup failed");

    const result = await createJournalEntry(
      {
        tenantId: TENANT_ID,
        periodId: period.data.period.id,
        entryDate: "2026-01-15",
        lines: [
          { accountId: header.data.account.id, debitCents: 1000 },
          { accountId: revenue.data.account.id, creditCents: 1000 }
        ]
      },
      deps
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("accounting-core.HEADER_ACCOUNT_NOT_POSTABLE");
  });

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

describe("accounting-core: setup", () => {
  it("gets one account by tenant and rejects cross-tenant account ids", async () => {
    const store = createMemoryAccountingCoreStore();
    const deps = { accountingCoreStore: store, now: fixedNow() };
    const tenantAccount = await createAccount(
      { tenantId: TENANT_ID, code: "1300", name: "Inventory", type: "asset" },
      deps
    );
    const otherTenantAccount = await createAccount(
      { tenantId: "tenant-2", code: "1300", name: "Inventory", type: "asset" },
      deps
    );
    if (!tenantAccount.ok || !otherTenantAccount.ok) throw new Error("setup failed");

    const found = await getAccount({ tenantId: TENANT_ID, accountId: tenantAccount.data.account.id }, deps);
    expect(found.ok).toBe(true);
    if (found.ok) {
      expect(found.data.account).toEqual(expect.objectContaining({ id: tenantAccount.data.account.id, tenantId: TENANT_ID, code: "1300" }));
    }

    const crossTenant = await getAccount({ tenantId: TENANT_ID, accountId: otherTenantAccount.data.account.id }, deps);
    expect(crossTenant.ok).toBe(false);
    if (!crossTenant.ok) expect(crossTenant.error.code).toBe("accounting-core.ACCOUNT_NOT_FOUND");
  });

  it("gets and lists fiscal periods through tenant-scoped read use cases", async () => {
    const store = createMemoryAccountingCoreStore();
    const deps = { accountingCoreStore: store, now: fixedNow() };
    const january = await createFiscalPeriod(
      { tenantId: TENANT_ID, name: "January 2026", startsOn: "2026-01-01", endsOn: "2026-01-31", status: "open" },
      deps
    );
    const february = await createFiscalPeriod(
      { tenantId: TENANT_ID, name: "February 2026", periodType: "quarter", startsOn: "2026-02-01", endsOn: "2026-02-28", status: "closed" },
      deps
    );
    const otherTenantPeriod = await createFiscalPeriod(
      { tenantId: "tenant-2", name: "January 2026", startsOn: "2026-01-01", endsOn: "2026-01-31", status: "open" },
      deps
    );
    if (!january.ok || !february.ok || !otherTenantPeriod.ok) throw new Error("setup failed");

    const found = await getFiscalPeriod({ tenantId: TENANT_ID, periodId: january.data.period.id }, deps);
    expect(found.ok).toBe(true);
    if (found.ok) {
      expect(found.data.period).toEqual(
        expect.objectContaining({ id: january.data.period.id, tenantId: TENANT_ID, name: "January 2026", periodType: "month" })
      );
    }

    const crossTenant = await getFiscalPeriod({ tenantId: TENANT_ID, periodId: otherTenantPeriod.data.period.id }, deps);
    expect(crossTenant.ok).toBe(false);
    if (!crossTenant.ok) expect(crossTenant.error.code).toBe("accounting-core.FISCAL_PERIOD_NOT_FOUND");

    const openPeriods = await listFiscalPeriods({ tenantId: TENANT_ID, status: "open" }, deps);
    expect(openPeriods.ok).toBe(true);
    if (openPeriods.ok) {
      expect(openPeriods.data.periods).toEqual([expect.objectContaining({ id: january.data.period.id, status: "open" })]);
    }

    const quarterPeriods = await listFiscalPeriods({ tenantId: TENANT_ID, periodType: "quarter" }, deps);
    expect(quarterPeriods.ok).toBe(true);
    if (quarterPeriods.ok) {
      expect(quarterPeriods.data.periods).toEqual([expect.objectContaining({ id: february.data.period.id, periodType: "quarter" })]);
    }
  });

  it("enforces source-style fiscal period close, reopen, and lock transitions", async () => {
    const store = createMemoryAccountingCoreStore();
    const deps = { accountingCoreStore: store, now: fixedNow() };
    const created = await createFiscalPeriod(
      { tenantId: TENANT_ID, name: "January 2026", startsOn: "2026-01-01", endsOn: "2026-01-31" },
      deps
    );
    if (!created.ok) throw new Error(created.error.message);

    const lockedFromOpen = await lockFiscalPeriod({ tenantId: TENANT_ID, periodId: created.data.period.id, actorId: "actor-1" }, deps);
    expect(lockedFromOpen.ok).toBe(false);
    if (!lockedFromOpen.ok) expect(lockedFromOpen.error.code).toBe("accounting-core.INVALID_FISCAL_PERIOD_TRANSITION");

    const closed = await closeFiscalPeriod({ tenantId: TENANT_ID, periodId: created.data.period.id, actorId: "actor-1" }, deps);
    expect(closed.ok).toBe(true);
    if (!closed.ok) throw new Error(closed.error.message);
    expect(closed.data.period).toEqual(
      expect.objectContaining({
        status: "closed",
        closedById: "actor-1",
        closedAt: "2026-01-15T12:00:00.000Z",
        lockedAt: null
      })
    );

    const reopened = await reopenFiscalPeriod({ tenantId: TENANT_ID, periodId: created.data.period.id, actorId: "actor-1" }, deps);
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) throw new Error(reopened.error.message);
    expect(reopened.data.period).toEqual(expect.objectContaining({ status: "open", closedById: null, closedAt: null, lockedAt: null }));

    const closedAgain = await updateFiscalPeriodStatus(
      { tenantId: TENANT_ID, periodId: created.data.period.id, status: "closed", actorId: "actor-1" },
      deps
    );
    expect(closedAgain.ok).toBe(true);
    const locked = await lockFiscalPeriod({ tenantId: TENANT_ID, periodId: created.data.period.id, actorId: "actor-1" }, deps);
    expect(locked.ok).toBe(true);
    if (!locked.ok) throw new Error(locked.error.message);
    expect(locked.data.period).toEqual(
      expect.objectContaining({
        status: "locked",
        closedById: "actor-1",
        closedAt: "2026-01-15T12:00:00.000Z",
        lockedAt: "2026-01-15T12:00:00.000Z"
      })
    );

    const reopenedLocked = await reopenFiscalPeriod({ tenantId: TENANT_ID, periodId: created.data.period.id, actorId: "actor-1" }, deps);
    expect(reopenedLocked.ok).toBe(false);
    if (!reopenedLocked.ok) expect(reopenedLocked.error.code).toBe("accounting-core.INVALID_FISCAL_PERIOD_TRANSITION");
  });

  it("rejects no-op and invalid fiscal period status transitions", async () => {
    const cases = [
      { from: "open", to: "open" },
      { from: "open", to: "locked" },
      { from: "closed", to: "closed" },
      { from: "locked", to: "open" },
      { from: "locked", to: "closed" },
      { from: "locked", to: "locked" }
    ] as const;

    for (const testCase of cases) {
      const setup = await setupLedger(testCase.from);
      const result = await updateFiscalPeriodStatus(
        { tenantId: TENANT_ID, periodId: setup.period.id, status: testCase.to, actorId: "actor-1" },
        setup.deps
      );

      expect(result.ok, `${testCase.from} -> ${testCase.to}`).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("accounting-core.INVALID_FISCAL_PERIOD_TRANSITION");
    }
  });

  it("rejects fiscal period lifecycle writes when the status changed after read", async () => {
    const store = createMemoryAccountingCoreStore();
    let raced = false;
    let eventWrites = 0;
    const racingStore: AccountingCoreStore = {
      ...store,
      async updateFiscalPeriodIfCurrentStatus(period, expectedStatus) {
        if (!raced) {
          raced = true;
          const current = await store.getFiscalPeriod(period.tenantId, period.id);
          if (current) {
            await store.updateFiscalPeriod({
              ...current,
              status: "closed",
              closedAt: "2026-01-15T12:00:00.000Z",
              updatedAt: "2026-01-15T12:00:00.000Z"
            });
          }
        }
        return store.updateFiscalPeriodIfCurrentStatus(period, expectedStatus);
      },
      async writeEvent(event) {
        eventWrites += 1;
        await store.writeEvent(event);
      }
    };
    const deps = { accountingCoreStore: racingStore, now: fixedNow() };
    const created = await createFiscalPeriod(
      { tenantId: TENANT_ID, name: "January 2026", startsOn: "2026-01-01", endsOn: "2026-01-31" },
      deps
    );
    if (!created.ok) throw new Error(created.error.message);
    eventWrites = 0;

    const result = await closeFiscalPeriod({ tenantId: TENANT_ID, periodId: created.data.period.id, actorId: "actor-1" }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("accounting-core.FISCAL_PERIOD_TRANSITION_CONFLICT");
    expect(eventWrites).toBe(0);

    const stored = await store.getFiscalPeriod(TENANT_ID, created.data.period.id);
    expect(stored).toEqual(expect.objectContaining({ status: "closed" }));
  });

  it("guards D1 fiscal period status updates by tenant and expected status", async () => {
    const { d1 } = createTestD1(D1_FISCAL_PERIOD_SCHEMA);
    const store = createD1AccountingCoreStore(d1);
    const period: FiscalPeriod = {
      id: "per_d1",
      tenantId: TENANT_ID,
      name: "January 2026",
      periodType: "month",
      startsOn: "2026-01-01",
      endsOn: "2026-01-31",
      status: "open",
      closedById: null,
      closedAt: null,
      lockedAt: null,
      createdAt: "2026-01-15T12:00:00.000Z",
      updatedAt: "2026-01-15T12:00:00.000Z"
    };
    await store.insertFiscalPeriod(period);

    const closed: FiscalPeriod = {
      ...period,
      status: "closed",
      closedById: "actor-1",
      closedAt: "2026-01-15T12:01:00.000Z",
      updatedAt: "2026-01-15T12:01:00.000Z"
    };
    await expect(store.updateFiscalPeriodIfCurrentStatus(closed, "open")).resolves.toBe(true);

    const staleLock: FiscalPeriod = {
      ...closed,
      status: "locked",
      lockedAt: "2026-01-15T12:02:00.000Z",
      updatedAt: "2026-01-15T12:02:00.000Z"
    };
    await expect(store.updateFiscalPeriodIfCurrentStatus(staleLock, "open")).resolves.toBe(false);

    const wrongTenant: FiscalPeriod = { ...staleLock, tenantId: "tenant-2" };
    await expect(store.updateFiscalPeriodIfCurrentStatus(wrongTenant, "closed")).resolves.toBe(false);

    const stored = await store.getFiscalPeriod(TENANT_ID, period.id);
    expect(stored).toEqual(expect.objectContaining({ status: "closed", lockedAt: null }));
  });

  it("returns D1-backed general ledger rows with running balances", async () => {
    const { d1 } = createTestD1(D1_FISCAL_PERIOD_SCHEMA);
    const store = createD1AccountingCoreStore(d1);
    const baseAccount = {
      tenantId: TENANT_ID,
      subtype: null,
      parentId: null,
      currency: "USD",
      description: null,
      isSystem: false,
      isReconcilable: false,
      isHeader: false,
      active: true,
      createdAt: "2026-01-15T12:00:00.000Z",
      updatedAt: "2026-01-15T12:00:00.000Z"
    };
    const cash: Account = {
      ...baseAccount,
      id: "acct_cash",
      code: "1000",
      name: "Cash",
      type: "asset",
      normalBalance: "debit"
    };
    const revenue: Account = {
      ...baseAccount,
      id: "acct_revenue",
      code: "4000",
      name: "Sales Revenue",
      type: "revenue",
      normalBalance: "credit"
    };
    const period: FiscalPeriod = {
      id: "per_d1_gl",
      tenantId: TENANT_ID,
      name: "January 2026",
      periodType: "month",
      startsOn: "2026-01-01",
      endsOn: "2026-01-31",
      status: "open",
      closedById: null,
      closedAt: null,
      lockedAt: null,
      createdAt: "2026-01-15T12:00:00.000Z",
      updatedAt: "2026-01-15T12:00:00.000Z"
    };
    const entry: JournalEntry = {
      id: "je_d1",
      tenantId: TENANT_ID,
      periodId: period.id,
      entryDate: "2026-01-20",
      description: "Invoice posted",
      status: "posted",
      sourceRef: "invoice:d1",
      sourceType: "invoice",
      postedAt: "2026-01-20T12:00:00.000Z",
      postedById: "actor-1",
      voidedAt: null,
      voidedById: null,
      voidReason: null,
      reversalEntryId: null,
      reversesEntryId: null,
      createdById: "actor-1",
      createdAt: "2026-01-20T12:00:00.000Z",
      updatedAt: "2026-01-20T12:00:00.000Z"
    };
    const lines: JournalLine[] = [
      {
        id: "jl_cash",
        tenantId: TENANT_ID,
        entryId: entry.id,
        accountId: cash.id,
        description: "Cash received",
        debitCents: 3_000,
        creditCents: 0,
        createdAt: "2026-01-20T12:00:00.000Z"
      },
      {
        id: "jl_revenue",
        tenantId: TENANT_ID,
        entryId: entry.id,
        accountId: revenue.id,
        description: "Invoice revenue",
        debitCents: 0,
        creditCents: 3_000,
        createdAt: "2026-01-20T12:00:00.000Z"
      }
    ];

    await store.insertAccount(cash);
    await store.insertAccount(revenue);
    await store.insertFiscalPeriod(period);
    await store.insertJournalEntry(entry, lines);

    const report = await getGeneralLedger(
      { tenantId: TENANT_ID, accountId: revenue.id, startDate: "2026-01-01", endDate: "2026-01-31", includeOpeningBalance: true },
      { accountingCoreStore: store }
    );
    expect(report.ok).toBe(true);
    if (report.ok) {
      expect(report.data.generalLedger.entries).toEqual([
        expect.objectContaining({
          entryId: entry.id,
          lineDescription: "Invoice revenue",
          creditCents: 3_000,
          runningBalanceCents: 3_000
        })
      ]);
    }
  });

  it("seeds a donor-derived chart with hierarchy, system flags, reconcilable accounts, and contra balances", async () => {
    const store = createMemoryAccountingCoreStore();
    const deps = { accountingCoreStore: store, now: fixedNow() };

    const seeded = await seedChartOfAccounts({ tenantId: TENANT_ID, standard: "gaap", currency: "usd" }, deps);
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) throw new Error(seeded.error.message);
    expect(seeded.data.count).toBeGreaterThan(20);
    expect(seeded.data.standard).toBe("gaap");

    const accounts = await store.listAccounts({ tenantId: TENANT_ID, includeInactive: true });
    const assets = accounts.find((account) => account.code === "1000");
    const fixedAssets = accounts.find((account) => account.code === "1500");
    const checking = accounts.find((account) => account.code === "1111");
    const ar = accounts.find((account) => account.code === "1200");
    const ap = accounts.find((account) => account.code === "2110");
    const income = accounts.find((account) => account.code === "4100");
    const allowance = accounts.find((account) => account.code === "1250");
    expect(assets).toEqual(expect.objectContaining({ isHeader: true, parentId: null }));
    expect(fixedAssets).toEqual(expect.objectContaining({ name: "Fixed Assets", isHeader: true }));
    expect(checking).toEqual(expect.objectContaining({ isReconcilable: true, currency: "USD" }));
    expect(ar).toEqual(expect.objectContaining({ isSystem: true, subtype: "current_asset" }));
    expect(seeded.data.settings).toEqual(
      expect.objectContaining({
        accountingStandard: "gaap",
        baseCurrency: "USD",
        defaultArAccountId: ar?.id,
        defaultApAccountId: ap?.id,
        defaultIncomeAccountId: income?.id
      })
    );
    expect(allowance).toEqual(expect.objectContaining({ normalBalance: "credit" }));

    const duplicate = await seedChartOfAccounts({ tenantId: TENANT_ID }, deps);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.error.code).toBe("accounting-core.CHART_ALREADY_CONFIGURED");

    const status = await getAccountingSetupStatus({ tenantId: TENANT_ID }, deps);
    expect(status.ok).toBe(true);
    if (status.ok) {
      expect(status.data.status.accountsConfigured).toBe(true);
      expect(status.data.status.accountCount).toBe(seeded.data.count);
      expect(status.data.status.baseCurrency).toBe("USD");
      expect(status.data.status.settingsConfigured).toBe(true);
      expect(status.data.status.defaultAccountsConfigured).toBe(true);
      expect(status.data.status.settings).toEqual(
        expect.objectContaining({
          defaultArAccountId: ar?.id,
          defaultApAccountId: ap?.id,
          defaultIncomeAccountId: income?.id
        })
      );
    }
  });

  it("updates and validates tenant accounting settings default accounts", async () => {
    const store = createMemoryAccountingCoreStore();
    const deps = { accountingCoreStore: store, now: fixedNow() };
    const asset = await createAccount(
      { tenantId: TENANT_ID, code: "1200", name: "Accounts Receivable", type: "asset" },
      deps
    );
    const liability = await createAccount(
      { tenantId: TENANT_ID, code: "2110", name: "Accounts Payable", type: "liability" },
      deps
    );
    const revenue = await createAccount(
      { tenantId: TENANT_ID, code: "4100", name: "Sales Revenue", type: "revenue" },
      deps
    );
    const header = await createAccount(
      { tenantId: TENANT_ID, code: "4000", name: "Revenue", type: "revenue", isHeader: true },
      deps
    );
    if (!asset.ok || !liability.ok || !revenue.ok || !header.ok) throw new Error("setup failed");

    const updated = await updateAccountingSettings(
      {
        tenantId: TENANT_ID,
        accountingStandard: "ifrs",
        fiscalYearStartMonth: 4,
        baseCurrency: "eur",
        defaultArAccountId: asset.data.account.id,
        defaultApAccountId: liability.data.account.id,
        defaultIncomeAccountId: revenue.data.account.id
      },
      deps
    );

    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.settings).toEqual(
        expect.objectContaining({
          accountingStandard: "ifrs",
          fiscalYearStartMonth: 4,
          baseCurrency: "EUR",
          defaultArAccountId: asset.data.account.id,
          defaultApAccountId: liability.data.account.id,
          defaultIncomeAccountId: revenue.data.account.id
        })
      );
    }

    const wrongType = await updateAccountingSettings(
      { tenantId: TENANT_ID, defaultApAccountId: revenue.data.account.id },
      deps
    );
    expect(wrongType.ok).toBe(false);
    if (!wrongType.ok) expect(wrongType.error.code).toBe("accounting-core.DEFAULT_ACCOUNT_TYPE_MISMATCH");

    const headerAccount = await updateAccountingSettings(
      { tenantId: TENANT_ID, defaultIncomeAccountId: header.data.account.id },
      deps
    );
    expect(headerAccount.ok).toBe(false);
    if (!headerAccount.ok) expect(headerAccount.error.code).toBe("accounting-core.DEFAULT_ACCOUNT_IS_HEADER");
  });

  it("seeds an IFRS chart variant while preserving operational account flags", async () => {
    const store = createMemoryAccountingCoreStore();
    const deps = { accountingCoreStore: store, now: fixedNow() };

    const seeded = await seedChartOfAccounts({ tenantId: TENANT_ID, standard: "ifrs", currency: "EUR" }, deps);
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) throw new Error(seeded.error.message);
    expect(seeded.data.standard).toBe("ifrs");

    const accounts = await store.listAccounts({ tenantId: TENANT_ID, includeInactive: true });
    const nonCurrentAssets = accounts.find((account) => account.code === "1500");
    const ppe = accounts.find((account) => account.code === "1510");
    const checking = accounts.find((account) => account.code === "1111");
    const ap = accounts.find((account) => account.code === "2110");
    expect(nonCurrentAssets).toEqual(expect.objectContaining({ name: "Non-Current Assets", isHeader: true, currency: "EUR" }));
    expect(ppe).toEqual(expect.objectContaining({ name: "Property, Plant and Equipment", parentId: nonCurrentAssets?.id }));
    expect(checking).toEqual(expect.objectContaining({ isReconcilable: true, currency: "EUR" }));
    expect(ap).toEqual(expect.objectContaining({ isSystem: true, normalBalance: "credit" }));
  });

  it("generates monthly fiscal periods using a fiscal-year start month", async () => {
    const store = createMemoryAccountingCoreStore();
    const deps = { accountingCoreStore: store, now: fixedNow() };

    const seeded = await seedMonthlyFiscalPeriods(
      { tenantId: TENANT_ID, year: 2026, fiscalYearStartMonth: 4 },
      deps
    );
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) throw new Error(seeded.error.message);
    expect(seeded.data.periods).toHaveLength(12);
    expect(seeded.data.periods[0]).toEqual(
      expect.objectContaining({ name: "April 2026", startsOn: "2026-04-01", endsOn: "2026-04-30" })
    );
    expect(seeded.data.periods[11]).toEqual(
      expect.objectContaining({ name: "March 2027", startsOn: "2027-03-01", endsOn: "2027-03-31" })
    );

    const status = await getAccountingSetupStatus({ tenantId: TENANT_ID }, deps);
    expect(status.ok).toBe(true);
    if (status.ok) {
      expect(status.data.status.fiscalPeriodsConfigured).toBe(true);
      expect(status.data.status.fiscalPeriodCount).toBe(12);
    }
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

  it("returns a source-style general ledger with opening and running balances", async () => {
    const setup = await setupLedger();
    const first = await createBalancedEntry(setup, 10_000, "invoice:100", "2026-01-10");
    const second = await createBalancedEntry(setup, 2_500, "invoice:101", "2026-01-20");
    const firstPost = await postJournalEntry({ tenantId: TENANT_ID, entryId: first.id }, setup.deps);
    const secondPost = await postJournalEntry({ tenantId: TENANT_ID, entryId: second.id }, setup.deps);
    expect(firstPost.ok).toBe(true);
    expect(secondPost.ok).toBe(true);

    const report = await getGeneralLedger(
      {
        tenantId: TENANT_ID,
        accountId: setup.revenue.id,
        startDate: "2026-01-15",
        endDate: "2026-01-31",
        includeOpeningBalance: true
      },
      setup.deps
    );

    expect(report.ok).toBe(true);
    if (report.ok) {
      expect(report.data.generalLedger).toEqual(
        expect.objectContaining({
          tenantId: TENANT_ID,
          account: expect.objectContaining({ id: setup.revenue.id, normalBalance: "credit" }),
          openingBalanceCents: 10_000,
          totalDebitCents: 0,
          totalCreditCents: 2_500,
          closingBalanceCents: 12_500
        })
      );
      expect(report.data.generalLedger.entries).toEqual([
        expect.objectContaining({
          entryId: second.id,
          entryDate: "2026-01-20",
          sourceRef: "invoice:101",
          debitCents: 0,
          creditCents: 2_500,
          runningBalanceCents: 12_500
        })
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

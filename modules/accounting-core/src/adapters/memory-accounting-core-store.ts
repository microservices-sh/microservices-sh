import type { AccountingCoreStore } from "../ports";
import type {
  Account,
  AccountingEvent,
  AccountFilter,
  FiscalPeriod,
  FiscalPeriodFilter,
  JournalEntry,
  JournalLine,
  TrialBalanceFilter,
  TrialBalancePosting
} from "../types";

function cloneAccount(account: Account): Account {
  return { ...account };
}

function clonePeriod(period: FiscalPeriod): FiscalPeriod {
  return { ...period };
}

function cloneEntry(entry: JournalEntry): JournalEntry {
  return { ...entry };
}

function cloneLine(line: JournalLine): JournalLine {
  return { ...line };
}

function matchesAccountSearch(account: Account, search?: string): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return account.code.toLowerCase().includes(needle) || account.name.toLowerCase().includes(needle);
}

function accountVisible(account: Account, filter: AccountFilter): boolean {
  return (
    account.tenantId === filter.tenantId &&
    (filter.includeInactive || account.active) &&
    (!filter.type || account.type === filter.type) &&
    matchesAccountSearch(account, filter.search)
  );
}

function periodVisible(period: FiscalPeriod, filter: FiscalPeriodFilter): boolean {
  return (
    period.tenantId === filter.tenantId &&
    (!filter.status || period.status === filter.status) &&
    (!filter.periodType || period.periodType === filter.periodType)
  );
}

function trialBalanceEntryVisible(entry: JournalEntry, filter: TrialBalanceFilter): boolean {
  return (
    entry.tenantId === filter.tenantId &&
    (entry.status === "posted" || entry.status === "void") &&
    (!filter.periodId || entry.periodId === filter.periodId) &&
    (!filter.asOfDate || entry.entryDate <= filter.asOfDate)
  );
}

export function createMemoryAccountingCoreStore(): AccountingCoreStore {
  const accounts = new Map<string, Account>();
  const periods = new Map<string, FiscalPeriod>();
  const entries = new Map<string, JournalEntry>();
  const linesByEntry = new Map<string, JournalLine[]>();
  const events: AccountingEvent[] = [];

  return {
    async insertAccount(account) {
      accounts.set(account.id, cloneAccount(account));
    },

    async updateAccount(account) {
      accounts.set(account.id, cloneAccount(account));
    },

    async getAccount(tenantId, accountId) {
      const account = accounts.get(accountId);
      return account && account.tenantId === tenantId ? cloneAccount(account) : null;
    },

    async findAccountByCode(tenantId, code) {
      const found = [...accounts.values()].find((account) => account.tenantId === tenantId && account.code === code);
      return found ? cloneAccount(found) : null;
    },

    async listAccounts(filter) {
      return [...accounts.values()]
        .filter((account) => accountVisible(account, filter))
        .sort((a, b) => a.code.localeCompare(b.code))
        .slice(0, filter.limit ?? 500)
        .map(cloneAccount);
    },

    async insertFiscalPeriod(period) {
      periods.set(period.id, clonePeriod(period));
    },

    async updateFiscalPeriod(period) {
      periods.set(period.id, clonePeriod(period));
    },

    async getFiscalPeriod(tenantId, periodId) {
      const period = periods.get(periodId);
      return period && period.tenantId === tenantId ? clonePeriod(period) : null;
    },

    async listFiscalPeriods(filter) {
      return [...periods.values()]
        .filter((period) => periodVisible(period, filter))
        .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
        .slice(0, filter.limit ?? 100)
        .map(clonePeriod);
    },

    async insertJournalEntry(entry, lines) {
      entries.set(entry.id, cloneEntry(entry));
      linesByEntry.set(entry.id, lines.map(cloneLine));
    },

    async updateJournalEntry(entry, lines) {
      entries.set(entry.id, cloneEntry(entry));
      linesByEntry.set(entry.id, lines.map(cloneLine));
    },

    async getJournalEntry(tenantId, entryId) {
      const entry = entries.get(entryId);
      return entry && entry.tenantId === tenantId ? cloneEntry(entry) : null;
    },

    async listJournalLines(tenantId, entryId) {
      return (linesByEntry.get(entryId) ?? [])
        .filter((line) => line.tenantId === tenantId)
        .map(cloneLine);
    },

    async findPostedEntryBySourceRef(tenantId, sourceRef, excludeEntryId) {
      const found = [...entries.values()].find(
        (entry) =>
          entry.tenantId === tenantId &&
          entry.sourceRef === sourceRef &&
          entry.id !== excludeEntryId &&
          (entry.status === "posted" || entry.status === "void")
      );
      return found ? cloneEntry(found) : null;
    },

    async voidJournalEntry(original, reversal, reversalLines) {
      entries.set(original.id, cloneEntry(original));
      entries.set(reversal.id, cloneEntry(reversal));
      linesByEntry.set(reversal.id, reversalLines.map(cloneLine));
    },

    async listTrialBalancePostings(filter) {
      const totals = new Map<string, { account: Account; rawDebitCents: number; rawCreditCents: number }>();

      for (const entry of entries.values()) {
        if (!trialBalanceEntryVisible(entry, filter)) continue;
        for (const line of linesByEntry.get(entry.id) ?? []) {
          const account = accounts.get(line.accountId);
          if (!account || account.tenantId !== filter.tenantId) continue;
          const existing = totals.get(account.id) ?? {
            account: cloneAccount(account),
            rawDebitCents: 0,
            rawCreditCents: 0
          };
          existing.rawDebitCents += line.debitCents;
          existing.rawCreditCents += line.creditCents;
          totals.set(account.id, existing);
        }
      }

      return [...totals.values()].sort((a, b) => a.account.code.localeCompare(b.account.code));
    },

    async writeEvent(event) {
      events.push({ ...event, payload: { ...event.payload } });
    }
  };
}

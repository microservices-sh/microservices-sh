import type {
  Account,
  AccountingEvent,
  AccountFilter,
  FiscalPeriod,
  FiscalPeriodFilter,
  FiscalPeriodStatus,
  GeneralLedgerFilter,
  GeneralLedgerPosting,
  JournalEntry,
  JournalLine,
  TrialBalanceFilter,
  TrialBalancePosting
} from "../types";

export interface AccountingCoreStore {
  insertAccount(account: Account): Promise<void>;
  updateAccount(account: Account): Promise<void>;
  getAccount(tenantId: string, accountId: string): Promise<Account | null>;
  findAccountByCode(tenantId: string, code: string): Promise<Account | null>;
  listAccounts(filter: AccountFilter): Promise<Account[]>;

  insertFiscalPeriod(period: FiscalPeriod): Promise<void>;
  updateFiscalPeriod(period: FiscalPeriod): Promise<void>;
  updateFiscalPeriodIfCurrentStatus(period: FiscalPeriod, expectedStatus: FiscalPeriodStatus): Promise<boolean>;
  getFiscalPeriod(tenantId: string, periodId: string): Promise<FiscalPeriod | null>;
  listFiscalPeriods(filter: FiscalPeriodFilter): Promise<FiscalPeriod[]>;

  insertJournalEntry(entry: JournalEntry, lines: JournalLine[]): Promise<void>;
  updateJournalEntry(entry: JournalEntry, lines: JournalLine[]): Promise<void>;
  getJournalEntry(tenantId: string, entryId: string): Promise<JournalEntry | null>;
  listJournalLines(tenantId: string, entryId: string): Promise<JournalLine[]>;
  findPostedEntryBySourceRef(
    tenantId: string,
    sourceRef: string,
    excludeEntryId?: string
  ): Promise<JournalEntry | null>;
  voidJournalEntry(original: JournalEntry, reversal: JournalEntry, reversalLines: JournalLine[]): Promise<void>;

  listGeneralLedgerPostings(filter: GeneralLedgerFilter): Promise<GeneralLedgerPosting[]>;
  listTrialBalancePostings(filter: TrialBalanceFilter): Promise<TrialBalancePosting[]>;
  writeEvent(event: AccountingEvent): Promise<void>;
}

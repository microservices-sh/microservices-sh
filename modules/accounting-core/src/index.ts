export { manifest, moduleDefinition } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export {
  accountFilterSchema,
  accountIdentitySchema,
  accountInputSchema,
  accountingCoreConfigSchema,
  accountingSettingsSchema,
  accountRecordSchema,
  accountSubtypeSchema,
  accountTypeSchema,
  accountUpdateSchema,
  chartOfAccountsStandardSchema,
  fiscalPeriodFilterSchema,
  fiscalPeriodIdentitySchema,
  fiscalPeriodInputSchema,
  fiscalPeriodStatusSchema,
  fiscalPeriodStatusUpdateSchema,
  fiscalPeriodTransitionSchema,
  fiscalPeriodTypeSchema,
  generalLedgerSchema,
  journalEntryInputSchema,
  journalEntryStatusSchema,
  journalEntryUpdateSchema,
  journalLineInputSchema,
  normalBalanceSchema,
  postJournalEntrySchema,
  seedChartOfAccountsSchema,
  seedMonthlyFiscalPeriodsSchema,
  setupStatusInputSchema,
  trialBalanceSchema,
  voidJournalEntrySchema
} from "./schemas";
export { defaultAccountingCoreHooks } from "./hooks";
export { accountingCoreEvents } from "./events";
export { accountingCorePermissions } from "./permissions";
export { accountingCoreResources } from "./resources";
export { createMemoryAccountingCoreStore } from "./adapters/memory-accounting-core-store";
export { createD1AccountingCoreStore } from "./adapters/d1-accounting-core-store";
export { createAccount } from "./use-cases/create-account";
export { getAccount } from "./use-cases/get-account";
export { listAccounts } from "./use-cases/list-accounts";
export { createFiscalPeriod } from "./use-cases/create-fiscal-period";
export { closeFiscalPeriod } from "./use-cases/close-fiscal-period";
export { getFiscalPeriod } from "./use-cases/get-fiscal-period";
export { listFiscalPeriods } from "./use-cases/list-fiscal-periods";
export { lockFiscalPeriod } from "./use-cases/lock-fiscal-period";
export { reopenFiscalPeriod } from "./use-cases/reopen-fiscal-period";
export { updateFiscalPeriodStatus } from "./use-cases/update-fiscal-period-status";
export {
  getAccountingSetupStatus,
  seedChartOfAccounts,
  seedMonthlyFiscalPeriods,
  updateAccountingSettings
} from "./use-cases/setup-accounting";
export { createJournalEntry } from "./use-cases/create-journal-entry";
export { updateJournalEntry } from "./use-cases/update-journal-entry";
export { postJournalEntry } from "./use-cases/post-journal-entry";
export { voidJournalEntry } from "./use-cases/void-journal-entry";
export { getGeneralLedger } from "./use-cases/get-general-ledger";
export { getTrialBalance } from "./use-cases/get-trial-balance";
export type { AccountingCoreStore } from "./ports";
export type {
  Account,
  AccountingCoreConfig,
  AccountingEvent,
  AccountingSettings,
  AccountingSetupStatus,
  AccountFilter,
  AccountSubtype,
  AccountType,
  Actor,
  ChartOfAccountsStandard,
  FiscalPeriod,
  FiscalPeriodFilter,
  FiscalPeriodStatus,
  FiscalPeriodType,
  GeneralLedgerEntry,
  GeneralLedgerFilter,
  GeneralLedgerPosting,
  GeneralLedgerReport,
  JournalEntry,
  JournalEntryStatus,
  JournalEntryWithLines,
  JournalLine,
  ModuleResult,
  NormalBalance,
  TrialBalance,
  TrialBalanceFilter,
  TrialBalanceLine,
  TrialBalancePosting
} from "./types";

export const accountingCoreModule = {
  id: "accounting-core",
  version: "0.1.0"
} as const;

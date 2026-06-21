export { manifest, moduleDefinition } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export {
  accountFilterSchema,
  accountInputSchema,
  accountingCoreConfigSchema,
  accountRecordSchema,
  accountTypeSchema,
  accountUpdateSchema,
  fiscalPeriodFilterSchema,
  fiscalPeriodInputSchema,
  fiscalPeriodStatusSchema,
  fiscalPeriodStatusUpdateSchema,
  journalEntryInputSchema,
  journalEntryStatusSchema,
  journalEntryUpdateSchema,
  journalLineInputSchema,
  normalBalanceSchema,
  postJournalEntrySchema,
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
export { listAccounts } from "./use-cases/list-accounts";
export { createFiscalPeriod } from "./use-cases/create-fiscal-period";
export { updateFiscalPeriodStatus } from "./use-cases/update-fiscal-period-status";
export { createJournalEntry } from "./use-cases/create-journal-entry";
export { updateJournalEntry } from "./use-cases/update-journal-entry";
export { postJournalEntry } from "./use-cases/post-journal-entry";
export { voidJournalEntry } from "./use-cases/void-journal-entry";
export { getTrialBalance } from "./use-cases/get-trial-balance";
export type { AccountingCoreStore } from "./ports";
export type {
  Account,
  AccountingCoreConfig,
  AccountingEvent,
  AccountFilter,
  AccountType,
  Actor,
  FiscalPeriod,
  FiscalPeriodFilter,
  FiscalPeriodStatus,
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

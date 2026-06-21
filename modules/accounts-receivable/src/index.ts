export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { events as accountsReceivableEvents } from "./events";
export { permissions as accountsReceivablePermissions } from "./permissions";
export { resources as accountsReceivableResources } from "./resources";
export { defaultAccountsReceivableHooks } from "./hooks";
export {
  createAccountsReceivableMemoryService,
  createAccountsReceivableService,
  createSequentialAccountsReceivableIdFactory,
  getAccountsReceivableModuleStatus
} from "./service";
export { createD1AccountsReceivableStore } from "./adapters/d1";
export { createAccountsReceivableMemoryStore } from "./adapters/memory";
export type { AccountsReceivableHooks } from "./hooks";
export type { AccountsReceivableListFilter, AccountsReceivableStore } from "./ports";
export type {
  AccountsReceivableIdFactory,
  AccountsReceivableIdPrefix,
  AccountsReceivableService,
  AccountsReceivableServiceDeps
} from "./service";
export type { AccountsReceivableMemoryStoreState } from "./adapters/memory";
export type {
  AccountsReceivableConfig,
  AccountsReceivableRecord,
  ApplyPaymentInput,
  CustomerPayment,
  CustomerStatement,
  InvoiceSnapshot,
  ModuleResult,
  PaymentApplication,
  RecordCustomerPaymentInput,
  ReceivableAging,
  TenantContext
} from "./types";

export const accountsReceivableModule = {
  id: "accounts-receivable",
  version: "0.1.0"
} as const;

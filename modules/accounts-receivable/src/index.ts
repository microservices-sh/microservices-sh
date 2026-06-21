export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { events as accountsReceivableEvents } from "./events";
export { permissions as accountsReceivablePermissions } from "./permissions";
export { resources as accountsReceivableResources } from "./resources";
export { defaultAccountsReceivableHooks } from "./hooks";
export { createAccountsReceivableMemoryService, getAccountsReceivableModuleStatus } from "./service";
export type { AccountsReceivableHooks } from "./hooks";
export type { AccountsReceivableStore } from "./ports";
export type {
  AccountsReceivableConfig,
  AccountsReceivableRecord,
  CustomerPayment,
  CustomerStatement,
  InvoiceSnapshot,
  ModuleResult,
  PaymentApplication,
  ReceivableAging,
  TenantContext
} from "./types";

export const accountsReceivableModule = {
  id: "accounts-receivable",
  version: "0.1.0"
} as const;

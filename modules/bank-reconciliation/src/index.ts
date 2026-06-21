export { manifest, moduleDefinition } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { defaultBankReconciliationHooks } from "./hooks";
export { bankReconciliationEvents } from "./events";
export { bankReconciliationPermissions } from "./permissions";
export { bankReconciliationResources } from "./resources";
export { createBankReconciliationMemoryService, getBankReconciliationModuleStatus } from "./service";
export type { BankReconciliationStore } from "./ports";
export type {
  BankAccount,
  BankReconciliationConfig,
  BankReconciliationRecord,
  BankTransaction,
  BankTransactionMatchStatus,
  ModuleResult,
  ReconciliationSession,
  ReconciliationStatus,
  StatementImportResult,
  TenantContext
} from "./types";

export const bankReconciliationModule = {
  id: "bank-reconciliation",
  version: "0.1.0"
} as const;

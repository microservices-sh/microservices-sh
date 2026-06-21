export { manifest, moduleDefinition } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { defaultBankReconciliationHooks } from "./hooks";
export { bankReconciliationEvents } from "./events";
export { bankReconciliationPermissions } from "./permissions";
export { bankReconciliationResources } from "./resources";
export {
  createBankReconciliationMemoryService,
  createBankReconciliationService,
  createSequentialBankReconciliationIdFactory,
  getBankReconciliationModuleStatus
} from "./service";
export { createMemoryBankReconciliationStore } from "./adapters/memory-bank-reconciliation-store";
export { createD1BankReconciliationStore } from "./adapters/d1-bank-reconciliation-store";
export type { BankReconciliationStore } from "./ports";
export type {
  BankReconciliationIdFactory,
  BankReconciliationIdPrefix,
  BankReconciliationService,
  BankReconciliationServiceDeps,
  CreateBankAccountInput,
  ImportStatementCsvInput,
  StatementTransactionInput
} from "./service";
export type {
  BankAccount,
  BankReconciliationConfig,
  BankReconciliationRecord,
  BankStatementImport,
  BankStatementImportFieldMapping,
  BankStatementImportSource,
  BankStatementImportStatus,
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

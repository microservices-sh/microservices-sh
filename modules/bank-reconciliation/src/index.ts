export { manifest, moduleDefinition } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { defaultBankReconciliationHooks } from "./hooks";
export { bankReconciliationEvents } from "./events";
export { bankReconciliationPermissions } from "./permissions";
export { bankReconciliationResources } from "./resources";
export {
  bankStatementImportMappingPresets,
  createBankReconciliationMemoryService,
  createBankReconciliationService,
  createSequentialBankReconciliationIdFactory,
  getBankReconciliationModuleStatus,
  resolveStatementImportFieldMapping
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
  BankMatchTargetType,
  BankMatchType,
  BankReconciliationConfig,
  BankReconciliationRecord,
  BankStatementImport,
  BankStatementImportFieldMapping,
  BankStatementImportMappingPreset,
  BankStatementImportMappingPresetId,
  BankStatementImportSource,
  BankStatementImportStatus,
  BankTransactionMatch,
  BankTransaction,
  BankTransactionCorrectionResult,
  BankTransactionMatchStatus,
  CreateMatchInput,
  CreateMatchResult,
  ExcludeTransactionInput,
  MatchCandidate,
  MatchSuggestion,
  ModuleResult,
  ReconciliationSession,
  ReconciliationStatus,
  RestoreExcludedTransactionInput,
  SuggestMatchesInput,
  StatementImportResult,
  TenantContext,
  UnmatchTransactionInput
} from "./types";

export const bankReconciliationModule = {
  id: "bank-reconciliation",
  version: "0.1.0"
} as const;

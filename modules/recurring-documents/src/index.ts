export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export {
  recurringDocumentLineSchema,
  recurringDocumentTemplateSchema,
  recurringDocumentTypeSchema,
  recurringDocumentsConfigSchema,
  recurringDocumentsRecordSchema,
  recurringFrequencySchema,
  recurringTemplateStatusSchema
} from "./schemas";
export { defaultRecurringDocumentsHooks } from "./hooks";
export { recurringDocumentsEvents } from "./events";
export { recurringDocumentsPermissions } from "./permissions";
export { recurringDocumentsResources } from "./resources";
export {
  createRecurringDocumentsService,
  createSequentialRecurringDocumentsIdFactory,
  getRecurringDocumentsModuleStatus
} from "./service";
export { createD1RecurringDocumentsStore } from "./adapters/d1";
export { createRecurringDocumentsMemoryStore } from "./adapters/memory";
export type { RecurringDocumentsStore } from "./ports";
export type { RecurringDocumentsMemoryStoreState } from "./adapters/memory";
export type { RecurringDocumentsService, RecurringDocumentsServiceDeps } from "./service";
export type {
  CreateRecurringDocumentTemplateInput,
  GenerateDueRecurringDocumentsInput,
  GeneratedRecurringDocumentDraft,
  GenerateRecurringDocumentInput,
  ModuleResult,
  RecurringDocumentActionInput,
  RecurringDocumentGenerationResult,
  RecurringDocumentLine,
  RecurringDocumentLineInput,
  RecurringDocumentListFilter,
  RecurringDocumentStats,
  RecurringDocumentTemplate,
  RecurringDocumentType,
  RecurringDocumentsConfig,
  RecurringDocumentsIdFactory,
  RecurringDocumentsIdPrefix,
  RecurringFrequency,
  RecurringPartyType,
  RecurringTemplateStatus,
  TenantContext,
  UpdateRecurringDocumentTemplateInput
} from "./types";

export const recurringDocumentsModule = {
  id: "recurring-documents",
  version: "0.1.0"
} as const;

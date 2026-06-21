export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { estimateQuoteConfigSchema, estimateQuoteLineSchema, estimateQuoteRecordSchema, estimateQuoteSchema, estimateQuoteStatusSchema } from "./schemas";
export { defaultEstimateQuoteHooks } from "./hooks";
export { estimateQuoteEvents } from "./events";
export { estimateQuotePermissions } from "./permissions";
export { estimateQuoteResources } from "./resources";
export {
  createEstimateQuoteService,
  createSequentialEstimateQuoteIdFactory,
  getEstimateQuoteModuleStatus
} from "./service";
export { createD1EstimateQuoteStore } from "./adapters/d1";
export { createEstimateQuoteMemoryStore } from "./adapters/memory";
export type { EstimateQuoteStore } from "./ports";
export type { EstimateQuoteMemoryStoreState } from "./adapters/memory";
export type { EstimateQuoteService, EstimateQuoteServiceDeps } from "./service";
export type {
  ConvertEstimateQuoteInput,
  CreateEstimateQuoteInput,
  DeclineEstimateQuoteInput,
  EstimateQuote,
  EstimateQuoteActionInput,
  EstimateQuoteConfig,
  EstimateQuoteConversion,
  EstimateQuoteIdFactory,
  EstimateQuoteIdPrefix,
  EstimateQuoteLine,
  EstimateQuoteLineInput,
  EstimateQuoteListFilter,
  EstimateQuoteStats,
  EstimateQuoteStatus,
  ExpireEstimateQuotesInput,
  InvoiceDraftFromEstimate,
  ModuleResult,
  TenantContext,
  UpdateEstimateQuoteInput,
  VoidEstimateQuoteInput
} from "./types";

export const estimateQuoteModule = {
  id: "estimate-quote",
  version: "0.1.0"
} as const;

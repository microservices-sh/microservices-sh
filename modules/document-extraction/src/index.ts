export { manifest } from "./manifest";
export {
  createExtractionJobInputSchema,
  documentExtractionConfigSchema,
  documentExtractionJobSchema,
  documentExtractionRecordSchema,
  extractionDraftSchema,
  listExtractionJobsInputSchema,
  normalizeExtractionInputSchema,
  reviewExtractionInputSchema,
  submitExtractionDraftInputSchema
} from "./schemas";
export { defaultDocumentExtractionHooks } from "./hooks";
export { documentExtractionEvents } from "./events";
export { documentExtractionPermissions } from "./permissions";
export { documentExtractionResources } from "./resources";
export { createDocumentExtractionHandler } from "./http";
export { createExtractionJob } from "./use-cases/create-extraction-job";
export { getExtractionJob } from "./use-cases/get-extraction-job";
export { listExtractionJobs } from "./use-cases/list-extraction-jobs";
export { normalizeExtraction } from "./use-cases/normalize-extraction";
export { reviewExtraction } from "./use-cases/review-extraction";
export { submitExtractionDraft } from "./use-cases/submit-extraction-draft";
export { createD1DocumentExtractionStore } from "./adapters/d1-document-extraction-store";
export { createMemoryDocumentExtractionStore } from "./adapters/memory-document-extraction-store";
export { createGemmaExtractionNormalizer } from "./adapters/gemma-normalizer";
export type {
  DocumentExtractionConfig,
  DocumentExtractionJob,
  DocumentExtractionRecord,
  DocumentExtractionStore,
  DocumentReference,
  ExtractedField,
  ExtractedTable,
  ExtractionDraft,
  ExtractionMode,
  ExtractionNormalizer,
  ExtractionNormalizerInput,
  ExtractionRuntime,
  ModuleResult
} from "./types";

export const documentExtractionModule = {
  id: "document-extraction",
  version: "0.1.0"
} as const;

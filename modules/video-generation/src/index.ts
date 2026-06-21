export { manifest, moduleDefinition } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export {
  createVideoJobInputSchema,
  jsonObjectSchema,
  recordVideoProviderStatusInputSchema,
  videoAspectRatioSchema,
  videoGenerationConfigSchema,
  videoGenerationJobSchema,
  videoGenerationOutputSchema,
  videoGenerationRecordSchema,
  videoGenerationSnapshotSchema,
  videoJobStatusSchema,
  videoReferenceAssetSchema,
  videoResolutionSchema
} from "./schemas";
export { defaultVideoGenerationHooks } from "./hooks";
export { videoGenerationEvents } from "./events";
export { videoGenerationPermissions } from "./permissions";
export { videoGenerationResources } from "./resources";
export { createD1VideoGenerationStore } from "./adapters/d1";
export { createVideoGenerationMemoryStore } from "./adapters/memory";
export {
  createSequentialVideoGenerationIdFactory,
  createVideoGenerationService,
  getVideoGenerationModuleStatus
} from "./service";
export type { VideoGenerationStore } from "./ports";
export type { VideoGenerationMemoryStoreState } from "./adapters/memory";
export type { VideoGenerationService, VideoGenerationServiceDeps } from "./service";
export type {
  AttachVideoOutputInput,
  CancelVideoJobInput,
  CreateVideoJobInput,
  ListVideoJobsInput,
  ModuleResult,
  RecordVideoProviderStatusInput,
  SubmitVideoJobInput,
  TenantContext,
  VideoAspectRatio,
  VideoGenerationConfig,
  VideoGenerationIdFactory,
  VideoGenerationIdPrefix,
  VideoGenerationJob,
  VideoGenerationOutput,
  VideoGenerationProvider,
  VideoGenerationRecord,
  VideoGenerationSnapshot,
  VideoJobStatus,
  VideoProviderSubmitResult,
  VideoReferenceAsset,
  VideoResolution
} from "./types";

export const videoGenerationModule = {
  id: "video-generation",
  version: "0.1.0"
} as const;

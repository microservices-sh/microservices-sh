export { manifest, moduleDefinition } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export {
  addContentFieldInputSchema,
  cmsLocaleSchema,
  cmsMediaAssetSchema,
  contentCmsConfigSchema,
  contentCmsRecordSchema,
  contentEntryLocalizationSchema,
  contentEntrySchema,
  contentEntrySnapshotSchema,
  contentEntryVersionSchema,
  contentFieldDefinitionSchema,
  contentFieldTypeSchema,
  contentStatusSchema,
  contentTypeDefinitionSchema,
  createContentEntryInputSchema,
  createContentTypeInputSchema,
  jsonObjectSchema,
  localeDirectionSchema,
  localizationStatusSchema
} from "./schemas";
export { defaultContentCmsHooks } from "./hooks";
export { contentCmsEvents } from "./events";
export { contentCmsPermissions } from "./permissions";
export { contentCmsResources } from "./resources";
export { createD1ContentCmsStore } from "./adapters/d1";
export { createContentCmsMemoryStore } from "./adapters/memory";
export {
  createContentCmsService,
  createSequentialContentCmsIdFactory,
  getContentCmsModuleStatus
} from "./service";
export type { ContentCmsStore } from "./ports";
export type { ContentCmsMemoryStoreState } from "./adapters/memory";
export type { ContentCmsService, ContentCmsServiceDeps } from "./service";
export type {
  AddContentFieldInput,
  ArchiveEntryInput,
  CmsLocale,
  CmsMediaAsset,
  ContentCmsConfig,
  ContentCmsIdFactory,
  ContentCmsIdPrefix,
  ContentCmsRecord,
  ContentEntry,
  ContentEntryLocalization,
  ContentEntrySnapshot,
  ContentEntryVersion,
  ContentFieldDefinition,
  ContentFieldType,
  ContentStatus,
  ContentTypeDefinition,
  CreateContentEntryInput,
  CreateContentTypeInput,
  CreateLocaleInput,
  CreateMediaAssetInput,
  FieldConfig,
  FieldValidation,
  GetEntrySnapshotInput,
  LocaleDirection,
  LocalizationStatus,
  ModuleResult,
  PublishEntryInput,
  SaveEntryVersionInput,
  SortOrder,
  TenantContext,
  UpsertLocalizationInput
} from "./types";

export const contentCmsModule = {
  id: "content-cms",
  version: "0.1.0"
} as const;

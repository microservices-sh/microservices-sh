export { manifest } from "./manifest";
export { commerceSyncConfigSchema, commerceSyncRecordSchema } from "./schemas";
export { defaultCommerceSyncHooks } from "./hooks";
export { commerceSyncEvents } from "./events";
export { commerceSyncPermissions } from "./permissions";
export { commerceSyncResources } from "./resources";
export { createD1CommerceSyncStore } from "./adapters/d1-commerce-sync-store";
export { createMemoryCommerceSyncStore } from "./adapters/memory-commerce-sync-store";
export {
  createCommerceSyncMemoryService,
  createCommerceSyncService,
  getCommerceSyncModuleStatus,
  normalizeCommerceProviderPayload,
  verifyWooCommerceWebhookSignature
} from "./service";
export type { CreateCommerceSyncServiceOptions } from "./service";
export type { CommerceSyncStore } from "./ports";
export type {
  CommerceConnection,
  CommerceProvider,
  CommerceRawPayload,
  CommerceResourceType,
  CommerceSyncConfig,
  CommerceSyncIdGenerator,
  CommerceSyncMemoryService,
  CommerceSyncRecord,
  CommerceSyncService,
  CompleteSyncRunInput,
  CreateCommerceConnectionInput,
  ModuleResult,
  NormalizedCommerceAddress,
  NormalizedCommerceCategoryRef,
  NormalizedCommerceCouponLine,
  NormalizedCommerceEnvelope,
  NormalizedCommerceOrderLine,
  NormalizedCommerceOrderPayload,
  NormalizedCommercePayload,
  NormalizedCommerceProductPayload,
  NormalizedCommerceCustomerPayload,
  NormalizedCommerceShippingLine,
  NormalizedOrderStatus,
  NormalizeCommercePayloadInput,
  ProviderMapping,
  RecordProviderMappingInput,
  RecordWebhookReceiptInput,
  SyncRun,
  SyncRunStatus,
  TenantContext,
  WebhookReceipt
} from "./types";

export const commerceSyncModule = {
  id: "commerce-sync",
  version: "0.1.0"
} as const;

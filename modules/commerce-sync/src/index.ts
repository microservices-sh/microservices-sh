export { manifest } from "./manifest";
export { commerceSyncConfigSchema, commerceSyncRecordSchema } from "./schemas";
export { defaultCommerceSyncHooks } from "./hooks";
export { commerceSyncEvents } from "./events";
export { commerceSyncPermissions } from "./permissions";
export { commerceSyncResources } from "./resources";
export { createCommerceSyncMemoryService, getCommerceSyncModuleStatus } from "./service";
export type {
  CommerceConnection,
  CommerceProvider,
  CommerceResourceType,
  CommerceSyncConfig,
  CommerceSyncRecord,
  ModuleResult,
  NormalizedCommerceEnvelope,
  ProviderMapping,
  SyncRun,
  SyncRunStatus,
  TenantContext,
  WebhookReceipt
} from "./types";

export const commerceSyncModule = {
  id: "commerce-sync",
  version: "0.1.0"
} as const;

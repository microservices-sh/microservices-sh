export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export {
  storageAccountSchema,
  storageEntitlementsConfigSchema,
  storageEntitlementsRecordSchema,
  storageOwnerTypeSchema,
  storagePackageSchema,
  storagePurchaseStatusSchema,
  storageShareLinkSchema
} from "./schemas";
export { defaultStorageEntitlementsHooks } from "./hooks";
export { storageEntitlementsEvents } from "./events";
export { storageEntitlementsPermissions } from "./permissions";
export { storageEntitlementsResources } from "./resources";
export {
  createSequentialStorageEntitlementsIdFactory,
  createStorageEntitlementsService,
  getStorageEntitlementsModuleStatus
} from "./service";
export { createD1StorageEntitlementsStore } from "./adapters/d1";
export { createStorageEntitlementsMemoryStore } from "./adapters/memory";
export type { StorageEntitlementsStore } from "./ports";
export type { StorageEntitlementsMemoryStoreState } from "./adapters/memory";
export type { StorageEntitlementsService, StorageEntitlementsServiceDeps } from "./service";
export type {
  CompleteStoragePurchaseInput,
  CreateShareLinkInput,
  CreateStoragePackageInput,
  CreateStoragePurchaseInput,
  ModuleResult,
  StorageAccount,
  StorageEntitlementsConfig,
  StorageEntitlementsIdFactory,
  StorageEntitlementsIdPrefix,
  StorageInfo,
  StorageOwnerType,
  StoragePackage,
  StoragePurchase,
  StoragePurchaseStatus,
  StorageShareLink,
  StorageUsageInput,
  TenantContext
} from "./types";

export const storageEntitlementsModule = {
  id: "storage-entitlements",
  version: "0.1.0"
} as const;

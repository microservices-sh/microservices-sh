import type { StorageAccount, StorageOwnerType, StoragePackage, StoragePurchase, StorageShareLink } from "../types";

export interface StorageEntitlementsStore {
  getAccount(tenantId: string, ownerType: StorageOwnerType, ownerId: string): Promise<StorageAccount | null>;
  insertAccountIfMissing(account: StorageAccount): Promise<void>;
  reserveAccountBytes(tenantId: string, ownerType: StorageOwnerType, ownerId: string, sizeBytes: number, updatedAt: string): Promise<StorageAccount | null>;
  releaseAccountBytes(tenantId: string, ownerType: StorageOwnerType, ownerId: string, sizeBytes: number, updatedAt: string): Promise<StorageAccount | null>;
  addQuotaBytes(tenantId: string, ownerType: StorageOwnerType, ownerId: string, quotaBytes: number, updatedAt: string): Promise<StorageAccount | null>;
  upsertAccount(account: StorageAccount): Promise<void>;

  getPackage(tenantId: string, packageId: string): Promise<StoragePackage | null>;
  upsertPackage(pkg: StoragePackage): Promise<void>;
  listPackages(tenantId: string, includeInactive?: boolean): Promise<StoragePackage[]>;

  insertPurchase(purchase: StoragePurchase): Promise<void>;
  updatePurchase(purchase: StoragePurchase): Promise<void>;
  getPurchase(tenantId: string, purchaseId: string): Promise<StoragePurchase | null>;
  getPurchaseByExternalSession(tenantId: string, externalSessionId: string): Promise<StoragePurchase | null>;

  insertShareLink(link: StorageShareLink): Promise<void>;
  updateShareLink(link: StorageShareLink): Promise<void>;
  getShareLink(tenantId: string, shareId: string): Promise<StorageShareLink | null>;
  getShareLinkByShortId(tenantId: string, shortId: string): Promise<StorageShareLink | null>;
  listExpiredShareLinks(tenantId: string, asOf: string, limit?: number): Promise<StorageShareLink[]>;
}

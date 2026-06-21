export interface StorageEntitlementsConfig {
  enabled: boolean;
  defaultQuotaBytes?: number;
  defaultCurrency?: string;
}

export type StorageEntitlementsIdPrefix = "stacct" | "stpkg" | "stpur" | "stshare";
export type StorageEntitlementsIdFactory = (prefix: StorageEntitlementsIdPrefix) => string;
export type StorageOwnerType = "user" | "customer" | "workspace";
export type StoragePurchaseStatus = "pending" | "completed" | "failed" | "refunded";

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export interface StorageAccount {
  id: string;
  tenantId: string;
  ownerType: StorageOwnerType;
  ownerId: string;
  quotaBytes: number;
  usedBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoragePackage {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  storageBytes: number;
  priceCents: number;
  currency: string;
  externalProductId: string | null;
  externalPriceId: string | null;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoragePurchase {
  id: string;
  tenantId: string;
  ownerType: StorageOwnerType;
  ownerId: string;
  packageId: string;
  amountCents: number;
  storageBytes: number;
  currency: string;
  status: StoragePurchaseStatus;
  externalPaymentId: string | null;
  externalSessionId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface StorageShareLink {
  id: string;
  tenantId: string;
  ownerType: StorageOwnerType;
  ownerId: string;
  fileId: string;
  shortId: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number;
  expiresAt: string;
  expiryDays: number;
  downloadCount: number;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StorageInfo {
  quotaBytes: number;
  usedBytes: number;
  remainingBytes: number;
  usedBasisPoints: number;
}

export interface CreateStoragePackageInput {
  id?: string;
  name: string;
  description?: string | null;
  storageBytes: number;
  priceCents: number;
  currency?: string;
  externalProductId?: string | null;
  externalPriceId?: string | null;
  isPopular?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CreateStoragePurchaseInput {
  ownerType: StorageOwnerType;
  ownerId: string;
  packageId: string;
  externalSessionId?: string | null;
  externalPaymentId?: string | null;
}

export interface CompleteStoragePurchaseInput {
  purchaseId?: string;
  externalSessionId?: string | null;
  externalPaymentId?: string | null;
}

export interface StorageUsageInput {
  ownerType: StorageOwnerType;
  ownerId: string;
  sizeBytes: number;
}

export interface CreateShareLinkInput {
  ownerType: StorageOwnerType;
  ownerId: string;
  fileId: string;
  originalName: string;
  mimeType?: string | null;
  sizeBytes: number;
  expiryDays: number;
  shortId?: string;
}

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

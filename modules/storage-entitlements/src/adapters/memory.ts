import type { StorageEntitlementsStore } from "../ports";
import type { StorageAccount, StorageOwnerType, StoragePackage, StoragePurchase, StorageShareLink } from "../types";

export interface StorageEntitlementsMemoryStoreState {
  accounts?: StorageAccount[];
  packages?: StoragePackage[];
  purchases?: StoragePurchase[];
  shareLinks?: StorageShareLink[];
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function ownerKey(tenantId: string, ownerType: StorageOwnerType, ownerId: string): string {
  return `${tenantId}:${ownerType}:${ownerId}`;
}

export function createStorageEntitlementsMemoryStore(initialState: StorageEntitlementsMemoryStoreState = {}): StorageEntitlementsStore {
  const accounts = new Map<string, StorageAccount>();
  const packages = new Map<string, StoragePackage>();
  const purchases = new Map<string, StoragePurchase>();
  const sessions = new Map<string, string>();
  const shares = new Map<string, StorageShareLink>();
  const shortIds = new Map<string, string>();

  for (const account of initialState.accounts ?? []) accounts.set(ownerKey(account.tenantId, account.ownerType, account.ownerId), copy(account));
  for (const pkg of initialState.packages ?? []) packages.set(pkg.id, copy(pkg));
  for (const purchase of initialState.purchases ?? []) {
    purchases.set(purchase.id, copy(purchase));
    if (purchase.externalSessionId) sessions.set(`${purchase.tenantId}:${purchase.externalSessionId}`, purchase.id);
  }
  for (const share of initialState.shareLinks ?? []) {
    shares.set(share.id, copy(share));
    shortIds.set(`${share.tenantId}:${share.shortId}`, share.id);
  }

  return {
    async getAccount(tenantId, ownerType, ownerId) {
      const account = accounts.get(ownerKey(tenantId, ownerType, ownerId));
      return account ? copy(account) : null;
    },

    async insertAccountIfMissing(account) {
      const key = ownerKey(account.tenantId, account.ownerType, account.ownerId);
      if (!accounts.has(key)) accounts.set(key, copy(account));
    },

    async reserveAccountBytes(tenantId, ownerType, ownerId, sizeBytes, updatedAt) {
      const key = ownerKey(tenantId, ownerType, ownerId);
      const account = accounts.get(key);
      if (!account || account.usedBytes + sizeBytes > account.quotaBytes) return null;
      const updated = { ...account, usedBytes: account.usedBytes + sizeBytes, updatedAt };
      accounts.set(key, copy(updated));
      return copy(updated);
    },

    async releaseAccountBytes(tenantId, ownerType, ownerId, sizeBytes, updatedAt) {
      const key = ownerKey(tenantId, ownerType, ownerId);
      const account = accounts.get(key);
      if (!account) return null;
      const updated = { ...account, usedBytes: Math.max(0, account.usedBytes - sizeBytes), updatedAt };
      accounts.set(key, copy(updated));
      return copy(updated);
    },

    async addQuotaBytes(tenantId, ownerType, ownerId, quotaBytes, updatedAt) {
      const key = ownerKey(tenantId, ownerType, ownerId);
      const account = accounts.get(key);
      if (!account) return null;
      const updated = { ...account, quotaBytes: account.quotaBytes + quotaBytes, updatedAt };
      accounts.set(key, copy(updated));
      return copy(updated);
    },

    async upsertAccount(account) {
      accounts.set(ownerKey(account.tenantId, account.ownerType, account.ownerId), copy(account));
    },

    async getPackage(tenantId, packageId) {
      const pkg = packages.get(packageId);
      return pkg?.tenantId === tenantId ? copy(pkg) : null;
    },

    async upsertPackage(pkg) {
      packages.set(pkg.id, copy(pkg));
    },

    async listPackages(tenantId, includeInactive = false) {
      return [...packages.values()]
        .filter((pkg) => pkg.tenantId === tenantId && (includeInactive || pkg.isActive))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.priceCents - b.priceCents)
        .map(copy);
    },

    async insertPurchase(purchase) {
      purchases.set(purchase.id, copy(purchase));
      if (purchase.externalSessionId) sessions.set(`${purchase.tenantId}:${purchase.externalSessionId}`, purchase.id);
    },

    async updatePurchase(purchase) {
      purchases.set(purchase.id, copy(purchase));
      if (purchase.externalSessionId) sessions.set(`${purchase.tenantId}:${purchase.externalSessionId}`, purchase.id);
    },

    async getPurchase(tenantId, purchaseId) {
      const purchase = purchases.get(purchaseId);
      return purchase?.tenantId === tenantId ? copy(purchase) : null;
    },

    async getPurchaseByExternalSession(tenantId, externalSessionId) {
      const purchaseId = sessions.get(`${tenantId}:${externalSessionId}`);
      const purchase = purchaseId ? purchases.get(purchaseId) : null;
      return purchase ? copy(purchase) : null;
    },

    async insertShareLink(link) {
      shares.set(link.id, copy(link));
      shortIds.set(`${link.tenantId}:${link.shortId}`, link.id);
    },

    async updateShareLink(link) {
      shares.set(link.id, copy(link));
      shortIds.set(`${link.tenantId}:${link.shortId}`, link.id);
    },

    async getShareLink(tenantId, shareId) {
      const link = shares.get(shareId);
      return link?.tenantId === tenantId ? copy(link) : null;
    },

    async getShareLinkByShortId(tenantId, shortId) {
      const shareId = shortIds.get(`${tenantId}:${shortId}`);
      const link = shareId ? shares.get(shareId) : null;
      return link ? copy(link) : null;
    },

    async listExpiredShareLinks(tenantId, asOf, limit) {
      const rows = [...shares.values()]
        .filter((share) => share.tenantId === tenantId && !share.revokedAt && share.expiresAt <= asOf)
        .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
      return rows.slice(0, limit ?? rows.length).map(copy);
    }
  };
}

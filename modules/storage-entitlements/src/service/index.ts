import type { StorageEntitlementsStore } from "../ports";
import type {
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
  StorageShareLink,
  StorageUsageInput,
  TenantContext
} from "../types";

export interface StorageEntitlementsServiceDeps {
  store: StorageEntitlementsStore;
  createId?: StorageEntitlementsIdFactory;
  config?: StorageEntitlementsConfig;
}

export interface StorageEntitlementsService {
  getStorageInfo(ctx: TenantContext, ownerType: StorageOwnerType, ownerId: string): Promise<ModuleResult<StorageInfo>>;
  canStoreBytes(ctx: TenantContext, input: StorageUsageInput): Promise<ModuleResult<StorageInfo>>;
  recordFileStored(ctx: TenantContext, input: StorageUsageInput): Promise<ModuleResult<StorageAccount>>;
  recordFileDeleted(ctx: TenantContext, input: StorageUsageInput): Promise<ModuleResult<StorageAccount>>;
  createStoragePackage(ctx: TenantContext, input: CreateStoragePackageInput): Promise<ModuleResult<StoragePackage>>;
  listStoragePackages(ctx: TenantContext, includeInactive?: boolean): Promise<ModuleResult<StoragePackage[]>>;
  createStoragePurchase(ctx: TenantContext, input: CreateStoragePurchaseInput): Promise<ModuleResult<StoragePurchase>>;
  completeStoragePurchase(ctx: TenantContext, input: CompleteStoragePurchaseInput): Promise<ModuleResult<{ account: StorageAccount; purchase: StoragePurchase }>>;
  createShareLink(ctx: TenantContext, input: CreateShareLinkInput): Promise<ModuleResult<StorageShareLink>>;
  resolveShareLink(ctx: TenantContext, shortId: string): Promise<ModuleResult<StorageShareLink>>;
  recordShareDownload(ctx: TenantContext, shortId: string): Promise<ModuleResult<StorageShareLink>>;
  revokeShareLink(ctx: TenantContext, shareId: string): Promise<ModuleResult<StorageShareLink>>;
  cleanupExpiredShareLinks(ctx: TenantContext, asOf: string, limit?: number): Promise<ModuleResult<StorageShareLink[]>>;
}

function ok<T>(data: T): ModuleResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): ModuleResult<T> {
  return { ok: false, error: { code, message } };
}

function now(ctx: TenantContext): string {
  return ctx.now ?? new Date().toISOString();
}

function addDays(value: string, days: number): string {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function id(prefix: string, sequence: number): string {
  return `${prefix}_${sequence.toString().padStart(6, "0")}`;
}

export function createSequentialStorageEntitlementsIdFactory(): StorageEntitlementsIdFactory {
  const sequences: Record<StorageEntitlementsIdPrefix, number> = { stacct: 0, stpkg: 0, stpur: 0, stshare: 0 };
  return (prefix) => id(prefix, ++sequences[prefix]);
}

function defaultId(prefix: StorageEntitlementsIdPrefix): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const randomId = uuid ? uuid.replaceAll("-", "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId.slice(0, 24)}`;
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanCurrency(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim().toUpperCase();
  return trimmed && /^[A-Z]{3}$/.test(trimmed) ? trimmed : fallback;
}

function positiveInteger(value: number | undefined): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0;
}

function usage(account: StorageAccount): StorageInfo {
  const remainingBytes = Math.max(0, account.quotaBytes - account.usedBytes);
  return {
    quotaBytes: account.quotaBytes,
    usedBytes: account.usedBytes,
    remainingBytes,
    usedBasisPoints: account.quotaBytes > 0 ? Math.round((account.usedBytes / account.quotaBytes) * 10000) : 0
  };
}

function shortIdFrom(idValue: string): string {
  return idValue.replace(/[^a-zA-Z0-9]/g, "").slice(-10) || Math.random().toString(36).slice(2, 12);
}

export function createStorageEntitlementsService(deps: StorageEntitlementsServiceDeps): StorageEntitlementsService {
  const createId = deps.createId ?? defaultId;
  const defaultQuotaBytes = deps.config?.defaultQuotaBytes ?? 2147483648;
  const defaultCurrency = cleanCurrency(deps.config?.defaultCurrency, "USD");

  async function getOrCreateAccount(ctx: TenantContext, ownerType: StorageOwnerType, ownerId: string): Promise<StorageAccount> {
    const existing = await deps.store.getAccount(ctx.tenantId, ownerType, ownerId);
    if (existing) return existing;
    const timestamp = now(ctx);
    const account: StorageAccount = {
      id: createId("stacct"),
      tenantId: ctx.tenantId,
      ownerType,
      ownerId,
      quotaBytes: defaultQuotaBytes,
      usedBytes: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await deps.store.upsertAccount(account);
    return account;
  }

  async function resolvePurchase(ctx: TenantContext, input: CompleteStoragePurchaseInput): Promise<StoragePurchase | null> {
    if (input.purchaseId) return deps.store.getPurchase(ctx.tenantId, input.purchaseId);
    if (input.externalSessionId) return deps.store.getPurchaseByExternalSession(ctx.tenantId, input.externalSessionId);
    return null;
  }

  async function resolveActiveShareLink(ctx: TenantContext, shortId: string): Promise<ModuleResult<StorageShareLink>> {
    const link = await deps.store.getShareLinkByShortId(ctx.tenantId, shortId.trim());
    if (!link || link.revokedAt || link.expiresAt <= now(ctx)) return fail("share_link_not_found", "Share link was not found or has expired.");
    return ok(link);
  }

  return {
    async getStorageInfo(ctx, ownerType, ownerId) {
      if (!ownerId.trim()) return fail("owner_required", "Storage owner id is required.");
      return ok(usage(await getOrCreateAccount(ctx, ownerType, ownerId.trim())));
    },

    async canStoreBytes(ctx, input) {
      const sizeBytes = positiveInteger(input.sizeBytes);
      if (!sizeBytes) return fail("size_required", "Storage operation requires a positive byte size.");
      const account = await getOrCreateAccount(ctx, input.ownerType, input.ownerId);
      if (account.usedBytes + sizeBytes > account.quotaBytes) return fail("storage_quota_exceeded", "Storage quota would be exceeded.");
      return ok(usage(account));
    },

    async recordFileStored(ctx, input) {
      const sizeBytes = positiveInteger(input.sizeBytes);
      if (!sizeBytes) return fail("size_required", "Storage operation requires a positive byte size.");
      const account = await getOrCreateAccount(ctx, input.ownerType, input.ownerId);
      if (account.usedBytes + sizeBytes > account.quotaBytes) return fail("storage_quota_exceeded", "Storage quota would be exceeded.");
      const updated = { ...account, usedBytes: account.usedBytes + sizeBytes, updatedAt: now(ctx) };
      await deps.store.upsertAccount(updated);
      return ok(updated);
    },

    async recordFileDeleted(ctx, input) {
      const sizeBytes = positiveInteger(input.sizeBytes);
      if (!sizeBytes) return fail("size_required", "Storage operation requires a positive byte size.");
      const account = await getOrCreateAccount(ctx, input.ownerType, input.ownerId);
      const updated = { ...account, usedBytes: Math.max(0, account.usedBytes - sizeBytes), updatedAt: now(ctx) };
      await deps.store.upsertAccount(updated);
      return ok(updated);
    },

    async createStoragePackage(ctx, input) {
      if (!input.name.trim()) return fail("package_name_required", "Storage package name is required.");
      const storageBytes = positiveInteger(input.storageBytes);
      const priceCents = positiveInteger(input.priceCents);
      if (!storageBytes) return fail("storage_bytes_required", "Storage package requires positive storage bytes.");
      if (!priceCents) return fail("price_required", "Storage package requires positive price cents.");
      const timestamp = now(ctx);
      const pkg: StoragePackage = {
        id: input.id?.trim() || createId("stpkg"),
        tenantId: ctx.tenantId,
        name: input.name.trim(),
        description: cleanText(input.description),
        storageBytes,
        priceCents,
        currency: cleanCurrency(input.currency, defaultCurrency),
        externalProductId: cleanText(input.externalProductId),
        externalPriceId: cleanText(input.externalPriceId),
        isPopular: input.isPopular ?? false,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertPackage(pkg);
      return ok(pkg);
    },

    async listStoragePackages(ctx, includeInactive = false) {
      return ok(await deps.store.listPackages(ctx.tenantId, includeInactive));
    },

    async createStoragePurchase(ctx, input) {
      const pkg = await deps.store.getPackage(ctx.tenantId, input.packageId);
      if (!pkg || !pkg.isActive) return fail("package_not_found", "Active storage package was not found.");
      const existing = input.externalSessionId ? await deps.store.getPurchaseByExternalSession(ctx.tenantId, input.externalSessionId) : null;
      if (existing) return ok(existing);
      const timestamp = now(ctx);
      const purchase: StoragePurchase = {
        id: createId("stpur"),
        tenantId: ctx.tenantId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        packageId: pkg.id,
        amountCents: pkg.priceCents,
        storageBytes: pkg.storageBytes,
        currency: pkg.currency,
        status: "pending",
        externalPaymentId: cleanText(input.externalPaymentId),
        externalSessionId: cleanText(input.externalSessionId),
        createdAt: timestamp,
        completedAt: null
      };
      await deps.store.insertPurchase(purchase);
      return ok(purchase);
    },

    async completeStoragePurchase(ctx, input) {
      const purchase = await resolvePurchase(ctx, input);
      if (!purchase) return fail("purchase_not_found", "Storage purchase was not found.");
      if (purchase.status === "completed") {
        const account = await getOrCreateAccount(ctx, purchase.ownerType, purchase.ownerId);
        return ok({ account, purchase });
      }
      if (purchase.status !== "pending") return fail("purchase_not_completable", "Only pending storage purchases can be completed.");
      const account = await getOrCreateAccount(ctx, purchase.ownerType, purchase.ownerId);
      const timestamp = now(ctx);
      const updatedAccount = { ...account, quotaBytes: account.quotaBytes + purchase.storageBytes, updatedAt: timestamp };
      const updatedPurchase = {
        ...purchase,
        status: "completed" as const,
        externalPaymentId: cleanText(input.externalPaymentId) ?? purchase.externalPaymentId,
        completedAt: timestamp
      };
      await deps.store.upsertAccount(updatedAccount);
      await deps.store.updatePurchase(updatedPurchase);
      return ok({ account: updatedAccount, purchase: updatedPurchase });
    },

    async createShareLink(ctx, input) {
      const sizeBytes = positiveInteger(input.sizeBytes);
      const expiryDays = positiveInteger(input.expiryDays);
      if (!input.fileId.trim()) return fail("file_required", "Share link requires a file id.");
      if (!input.originalName.trim()) return fail("file_name_required", "Share link requires an original file name.");
      if (!sizeBytes) return fail("size_required", "Share link requires positive file size.");
      if (![1, 7, 30].includes(expiryDays)) return fail("expiry_invalid", "Share link expiry must be 1, 7, or 30 days.");
      const timestamp = now(ctx);
      const idValue = createId("stshare");
      const link: StorageShareLink = {
        id: idValue,
        tenantId: ctx.tenantId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        fileId: input.fileId.trim(),
        shortId: input.shortId?.trim() || shortIdFrom(idValue),
        originalName: input.originalName.trim(),
        mimeType: cleanText(input.mimeType),
        sizeBytes,
        expiresAt: addDays(timestamp, expiryDays),
        expiryDays,
        downloadCount: 0,
        revokedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.insertShareLink(link);
      return ok(link);
    },

    async resolveShareLink(ctx, shortId) {
      return resolveActiveShareLink(ctx, shortId);
    },

    async recordShareDownload(ctx, shortId) {
      const resolved = await resolveActiveShareLink(ctx, shortId);
      if (!resolved.ok || !resolved.data) return resolved;
      const updated = { ...resolved.data, downloadCount: resolved.data.downloadCount + 1, updatedAt: now(ctx) };
      await deps.store.updateShareLink(updated);
      return ok(updated);
    },

    async revokeShareLink(ctx, shareId) {
      const link = await deps.store.getShareLink(ctx.tenantId, shareId);
      if (!link) return fail("share_link_not_found", "Share link was not found.");
      if (link.revokedAt) return ok(link);
      const updated = { ...link, revokedAt: now(ctx), updatedAt: now(ctx) };
      await deps.store.updateShareLink(updated);
      return ok(updated);
    },

    async cleanupExpiredShareLinks(ctx, asOf, limit) {
      return ok(await deps.store.listExpiredShareLinks(ctx.tenantId, asOf, limit));
    }
  };
}

export function getStorageEntitlementsModuleStatus() {
  return { id: "storage-entitlements", status: "draft" } as const;
}

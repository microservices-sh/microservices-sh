import type { StorageEntitlementsStore } from "../ports";
import type { StorageAccount, StorageOwnerType, StoragePackage, StoragePurchase, StoragePurchaseStatus, StorageShareLink } from "../types";

const ACCOUNT_COLS = "id, tenant_id, owner_type, owner_id, quota_bytes, used_bytes, created_at, updated_at";
const PACKAGE_COLS = "id, tenant_id, name, description, storage_bytes, price_cents, currency, external_product_id, external_price_id, is_popular, is_active, sort_order, created_at, updated_at";
const PURCHASE_COLS = "id, tenant_id, owner_type, owner_id, package_id, amount_cents, storage_bytes, currency, status, external_payment_id, external_session_id, created_at, completed_at";
const SHARE_COLS = "id, tenant_id, owner_type, owner_id, file_id, short_id, original_name, mime_type, size_bytes, expires_at, expiry_days, download_count, revoked_at, created_at, updated_at";

function bool(value: unknown): boolean {
  return Number(value ?? 0) === 1;
}

function nullable(value: unknown): string | null {
  return value == null ? null : String(value);
}

function toAccount(row: Record<string, unknown>): StorageAccount {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    ownerType: String(row.owner_type) as StorageOwnerType,
    ownerId: String(row.owner_id),
    quotaBytes: Number(row.quota_bytes ?? 0),
    usedBytes: Number(row.used_bytes ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toPackage(row: Record<string, unknown>): StoragePackage {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    description: nullable(row.description),
    storageBytes: Number(row.storage_bytes ?? 0),
    priceCents: Number(row.price_cents ?? 0),
    currency: String(row.currency),
    externalProductId: nullable(row.external_product_id),
    externalPriceId: nullable(row.external_price_id),
    isPopular: bool(row.is_popular),
    isActive: bool(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toPurchase(row: Record<string, unknown>): StoragePurchase {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    ownerType: String(row.owner_type) as StorageOwnerType,
    ownerId: String(row.owner_id),
    packageId: String(row.package_id),
    amountCents: Number(row.amount_cents ?? 0),
    storageBytes: Number(row.storage_bytes ?? 0),
    currency: String(row.currency),
    status: String(row.status) as StoragePurchaseStatus,
    externalPaymentId: nullable(row.external_payment_id),
    externalSessionId: nullable(row.external_session_id),
    createdAt: String(row.created_at),
    completedAt: nullable(row.completed_at)
  };
}

function toShare(row: Record<string, unknown>): StorageShareLink {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    ownerType: String(row.owner_type) as StorageOwnerType,
    ownerId: String(row.owner_id),
    fileId: String(row.file_id),
    shortId: String(row.short_id),
    originalName: String(row.original_name),
    mimeType: nullable(row.mime_type),
    sizeBytes: Number(row.size_bytes ?? 0),
    expiresAt: String(row.expires_at),
    expiryDays: Number(row.expiry_days ?? 0),
    downloadCount: Number(row.download_count ?? 0),
    revokedAt: nullable(row.revoked_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1StorageEntitlementsStore(db: D1Database): StorageEntitlementsStore {
  return {
    async getAccount(tenantId, ownerType, ownerId) {
      const row = await db.prepare(`SELECT ${ACCOUNT_COLS} FROM storage_accounts WHERE tenant_id = ? AND owner_type = ? AND owner_id = ?`).bind(tenantId, ownerType, ownerId).first<Record<string, unknown>>();
      return row ? toAccount(row) : null;
    },
    async upsertAccount(account) {
      await db.prepare(`INSERT INTO storage_accounts (${ACCOUNT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id, owner_type, owner_id) DO UPDATE SET quota_bytes = excluded.quota_bytes, used_bytes = excluded.used_bytes, updated_at = excluded.updated_at`)
        .bind(account.id, account.tenantId, account.ownerType, account.ownerId, account.quotaBytes, account.usedBytes, account.createdAt, account.updatedAt)
        .run();
    },
    async getPackage(tenantId, packageId) {
      const row = await db.prepare(`SELECT ${PACKAGE_COLS} FROM storage_packages WHERE tenant_id = ? AND id = ?`).bind(tenantId, packageId).first<Record<string, unknown>>();
      return row ? toPackage(row) : null;
    },
    async upsertPackage(pkg) {
      await db.prepare(
        `INSERT INTO storage_packages (${PACKAGE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, id) DO UPDATE SET name = excluded.name, description = excluded.description, storage_bytes = excluded.storage_bytes, price_cents = excluded.price_cents, currency = excluded.currency, external_product_id = excluded.external_product_id, external_price_id = excluded.external_price_id, is_popular = excluded.is_popular, is_active = excluded.is_active, sort_order = excluded.sort_order, updated_at = excluded.updated_at`
      )
        .bind(pkg.id, pkg.tenantId, pkg.name, pkg.description, pkg.storageBytes, pkg.priceCents, pkg.currency, pkg.externalProductId, pkg.externalPriceId, pkg.isPopular ? 1 : 0, pkg.isActive ? 1 : 0, pkg.sortOrder, pkg.createdAt, pkg.updatedAt)
        .run();
    },
    async listPackages(tenantId, includeInactive = false) {
      const result = await db.prepare(`SELECT ${PACKAGE_COLS} FROM storage_packages WHERE tenant_id = ? ${includeInactive ? "" : "AND is_active = 1"} ORDER BY sort_order ASC, price_cents ASC`).bind(tenantId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toPackage);
    },
    async insertPurchase(purchase) {
      await db.prepare(`INSERT INTO storage_purchases (${PURCHASE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(purchase.id, purchase.tenantId, purchase.ownerType, purchase.ownerId, purchase.packageId, purchase.amountCents, purchase.storageBytes, purchase.currency, purchase.status, purchase.externalPaymentId, purchase.externalSessionId, purchase.createdAt, purchase.completedAt)
        .run();
    },
    async updatePurchase(purchase) {
      await db.prepare("UPDATE storage_purchases SET status = ?, external_payment_id = ?, completed_at = ? WHERE tenant_id = ? AND id = ?")
        .bind(purchase.status, purchase.externalPaymentId, purchase.completedAt, purchase.tenantId, purchase.id)
        .run();
    },
    async getPurchase(tenantId, purchaseId) {
      const row = await db.prepare(`SELECT ${PURCHASE_COLS} FROM storage_purchases WHERE tenant_id = ? AND id = ?`).bind(tenantId, purchaseId).first<Record<string, unknown>>();
      return row ? toPurchase(row) : null;
    },
    async getPurchaseByExternalSession(tenantId, externalSessionId) {
      const row = await db.prepare(`SELECT ${PURCHASE_COLS} FROM storage_purchases WHERE tenant_id = ? AND external_session_id = ?`).bind(tenantId, externalSessionId).first<Record<string, unknown>>();
      return row ? toPurchase(row) : null;
    },
    async insertShareLink(link) {
      await db.prepare(`INSERT INTO storage_share_links (${SHARE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(link.id, link.tenantId, link.ownerType, link.ownerId, link.fileId, link.shortId, link.originalName, link.mimeType, link.sizeBytes, link.expiresAt, link.expiryDays, link.downloadCount, link.revokedAt, link.createdAt, link.updatedAt)
        .run();
    },
    async updateShareLink(link) {
      await db.prepare("UPDATE storage_share_links SET download_count = ?, revoked_at = ?, updated_at = ? WHERE tenant_id = ? AND id = ?")
        .bind(link.downloadCount, link.revokedAt, link.updatedAt, link.tenantId, link.id)
        .run();
    },
    async getShareLink(tenantId, shareId) {
      const row = await db.prepare(`SELECT ${SHARE_COLS} FROM storage_share_links WHERE tenant_id = ? AND id = ?`).bind(tenantId, shareId).first<Record<string, unknown>>();
      return row ? toShare(row) : null;
    },
    async getShareLinkByShortId(tenantId, shortId) {
      const row = await db.prepare(`SELECT ${SHARE_COLS} FROM storage_share_links WHERE tenant_id = ? AND short_id = ?`).bind(tenantId, shortId).first<Record<string, unknown>>();
      return row ? toShare(row) : null;
    },
    async listExpiredShareLinks(tenantId, asOf, limit = 100) {
      const result = await db.prepare(`SELECT ${SHARE_COLS} FROM storage_share_links WHERE tenant_id = ? AND revoked_at IS NULL AND expires_at <= ? ORDER BY expires_at ASC LIMIT ?`).bind(tenantId, asOf, limit).all<Record<string, unknown>>();
      return (result.results ?? []).map(toShare);
    }
  };
}

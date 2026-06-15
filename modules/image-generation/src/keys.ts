// Object-key construction — single source of truth for tenant isolation. Every
// image key is prefixed with the tenant id, so one tenant can never read or
// overwrite another's bytes even if a downstream query forgets a WHERE clause.

export function extensionForMime(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

// Tenant-scoped key: `${tenantId}/${imageId}.${ext}`. tenantId must be non-empty —
// callers without multi-tenancy should pass a stable constant.
export function buildImageKey(tenantId: string, imageId: string, mimeType: string): string {
  const safeTenant = tenantId.replace(/[^A-Za-z0-9._-]/g, "_");
  if (!safeTenant) throw new Error("tenantId is required for tenant-scoped image keys");
  return `${safeTenant}/${imageId}.${extensionForMime(mimeType)}`;
}

// Guard used by use-cases: confirm a key belongs to a tenant before a read/delete.
export function keyBelongsToTenant(key: string, tenantId: string): boolean {
  const safeTenant = tenantId.replace(/[^A-Za-z0-9._-]/g, "_");
  return key.startsWith(`${safeTenant}/`);
}

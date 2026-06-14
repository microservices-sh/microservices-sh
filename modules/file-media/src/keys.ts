// Object-key construction. The single source of truth for tenant isolation: every
// key is prefixed with the tenant id, so one tenant can never read or overwrite
// another's objects even if a query forgets a WHERE clause downstream.

// Strip path traversal and unsafe characters from a user-supplied filename.
export function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 120);
  return cleaned.length > 0 ? cleaned : "file";
}

// Tenant-scoped key: `${tenantId}/${uploadId}/${safeName}`. tenantId must be
// non-empty — callers without multi-tenancy should pass a stable constant.
export function buildObjectKey(tenantId: string, uploadId: string, fileName: string): string {
  const safeTenant = tenantId.replace(/[^A-Za-z0-9._-]/g, "_");
  if (!safeTenant) throw new Error("tenantId is required for tenant-scoped object keys");
  return `${safeTenant}/${uploadId}/${sanitizeFileName(fileName)}`;
}

// Guard used by adapters/use cases: confirm a key belongs to a tenant before a
// read/delete acts on it.
export function keyBelongsToTenant(key: string, tenantId: string): boolean {
  const safeTenant = tenantId.replace(/[^A-Za-z0-9._-]/g, "_");
  return key.startsWith(`${safeTenant}/`);
}

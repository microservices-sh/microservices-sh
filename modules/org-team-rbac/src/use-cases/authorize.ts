import { hasPermission } from "../authz";
import type { RbacStore } from "../ports";

// Resolve a user's effective permissions WITHIN an org. A non-member (or removed
// member) resolves to [] — the tenant-isolation boundary. Permissions come from
// the member's role, not a flat `role === "admin"` string check.
export async function resolvePermissions(orgId: string, userId: string, deps: { store: RbacStore }): Promise<string[]> {
  const membership = await deps.store.getMembership(orgId, userId);
  if (!membership || membership.status !== "active") return [];
  const role = await deps.store.getRole(membership.roleId);
  return role?.permissions ?? [];
}

// The gate every org-scoped route should call: is this user allowed to do this in
// this org? Resolves membership -> role -> permissions, then matches (wildcards
// supported). Returns 403 when not permitted.
export async function authorize(
  orgId: string,
  userId: string,
  permission: string,
  deps: { store: RbacStore }
) {
  const permissions = await resolvePermissions(orgId, userId, deps);
  const allowed = hasPermission(permissions, permission);
  if (!allowed) {
    return {
      ok: false as const,
      status: 403 as const,
      data: { allowed: false, orgId, userId, permission },
      error: { code: "FORBIDDEN", message: `User lacks ${permission} in org ${orgId}.` }
    };
  }
  return { ok: true as const, status: 200 as const, data: { allowed: true, orgId, userId, permission } };
}

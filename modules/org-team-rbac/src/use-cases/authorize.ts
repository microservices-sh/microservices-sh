import { ok, err } from "@microservices-sh/connection-contract";
import { hasPermission } from "../authz";
import { orgTeamRbacMeta } from "../meta";
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
// supported). Returns 403 when not permitted. Exposed as the `authorize` RPC
// (scope org.read) so other modules can scope against the org boundary.
//
// This use case is framework-neutral: it never imports SvelteKit or Hono.
export async function authorize(
  orgId: string,
  userId: string,
  permission: string,
  deps: { store: RbacStore; now?: () => number; correlationId?: string }
) {
  const meta = orgTeamRbacMeta(deps);
  const permissions = await resolvePermissions(orgId, userId, deps);
  const allowed = hasPermission(permissions, permission);
  if (!allowed) {
    return err(403, { code: "org-team-rbac.FORBIDDEN", message: `User lacks ${permission} in org ${orgId}.` }, meta);
  }
  return ok(200, { allowed: true, orgId, userId, permission }, meta);
}

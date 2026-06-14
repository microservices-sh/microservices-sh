import { onMembershipChanged } from "../hooks";
import type { RbacStore } from "../ports";

// Remove a member (soft: status -> removed). The last owner cannot be removed.
export async function removeMember(orgId: string, userId: string, deps: { store: RbacStore; now?: () => number }) {
  const membership = await deps.store.getMembership(orgId, userId);
  if (!membership || membership.status !== "active") {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "MEMBER_NOT_FOUND", message: "Active membership not found." } };
  }

  const role = await deps.store.getRole(membership.roleId);
  if (role?.permissions.includes("*")) {
    const owners = await deps.store.countOwners(orgId);
    if (owners <= 1) {
      return { ok: false as const, status: 409 as const, data: null, error: { code: "LAST_OWNER", message: "Cannot remove the last owner." } };
    }
  }

  membership.status = "removed";
  membership.updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.store.updateMembership(membership);
  await onMembershipChanged({ action: "removed", membership });

  return { ok: true as const, status: 200 as const, data: { orgId, userId, status: "removed" as const } };
}

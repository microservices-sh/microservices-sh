import { onMembershipChanged } from "../hooks";
import { updateMemberRoleInputSchema } from "../schemas";
import type { RbacStore } from "../ports";

// Change a member's role. The new role must belong to the org. Downgrading the
// last owner is refused so an org can never be left without an owner.
export async function updateMemberRole(input: unknown, deps: { store: RbacStore; now?: () => number }) {
  const parsed = updateMemberRoleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "INVALID_ROLE_INPUT", message: "Role-change input is invalid.", issues: parsed.error.issues } };
  }

  const membership = await deps.store.getMembership(parsed.data.orgId, parsed.data.userId);
  if (!membership || membership.status !== "active") {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "MEMBER_NOT_FOUND", message: "Active membership not found." } };
  }
  const nextRole = await deps.store.getRole(parsed.data.roleId);
  if (!nextRole || nextRole.orgId !== parsed.data.orgId) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "INVALID_ROLE", message: "Role does not belong to this organization." } };
  }

  const currentRole = await deps.store.getRole(membership.roleId);
  const isOwnerNow = !!currentRole?.permissions.includes("*");
  const willBeOwner = nextRole.permissions.includes("*");
  if (isOwnerNow && !willBeOwner) {
    const owners = await deps.store.countOwners(parsed.data.orgId);
    if (owners <= 1) {
      return { ok: false as const, status: 409 as const, data: null, error: { code: "LAST_OWNER", message: "Cannot downgrade the last owner." } };
    }
  }

  membership.roleId = parsed.data.roleId;
  membership.updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.store.updateMembership(membership);
  await onMembershipChanged({ action: "role_changed", membership });

  return { ok: true as const, status: 200 as const, data: { orgId: membership.orgId, userId: membership.userId, roleId: membership.roleId } };
}

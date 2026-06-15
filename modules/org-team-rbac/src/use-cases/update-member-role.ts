import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { onMembershipChanged } from "../hooks";
import { updateMemberRoleInputSchema } from "../schemas";
import { orgTeamRbacMeta } from "../meta";
import type { RbacStore } from "../ports";
import type { DomainEvent } from "../types";

// Change a member's role. The new role must belong to the org. Downgrading the
// last owner is refused so an org can never be left without an owner. Emits
// role.updated and notifies the cross-module onMembershipChanged observer chain.
//
// This use case is framework-neutral: it never imports SvelteKit or Hono.
export async function updateMemberRole(
  input: unknown,
  deps: {
    store: RbacStore;
    now?: () => number;
    correlationId?: string;
    onMembershipChangedHooks?: ResolvedHook[];
  }
) {
  const meta = orgTeamRbacMeta(deps);

  const parsed = updateMemberRoleInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "org-team-rbac.INVALID_ROLE_INPUT", message: "Role-change input is invalid.", issues: parsed.error.issues }, meta);
  }

  const membership = await deps.store.getMembership(parsed.data.orgId, parsed.data.userId);
  if (!membership || membership.status !== "active") {
    return err(404, { code: "org-team-rbac.MEMBER_NOT_FOUND", message: "Active membership not found." }, meta);
  }
  const nextRole = await deps.store.getRole(parsed.data.roleId);
  if (!nextRole || nextRole.orgId !== parsed.data.orgId) {
    return err(400, { code: "org-team-rbac.INVALID_ROLE", message: "Role does not belong to this organization." }, meta);
  }

  const currentRole = await deps.store.getRole(membership.roleId);
  const isOwnerNow = !!currentRole?.permissions.includes("*");
  const willBeOwner = nextRole.permissions.includes("*");
  if (isOwnerNow && !willBeOwner) {
    const owners = await deps.store.countOwners(parsed.data.orgId);
    if (owners <= 1) {
      return err(409, { code: "org-team-rbac.LAST_OWNER", message: "Cannot downgrade the last owner." }, meta);
    }
  }

  membership.roleId = parsed.data.roleId;
  membership.updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.store.updateMembership(membership);

  await onMembershipChanged({ action: "role_changed", membership });
  await runHooks(
    "onMembershipChanged",
    { action: "role_changed" as const, membership },
    { correlationId: meta.correlationId },
    deps.onMembershipChangedHooks ?? []
  );

  const event: DomainEvent = {
    name: "role.updated",
    correlationId: meta.correlationId,
    payload: { orgId: membership.orgId, userId: membership.userId, roleId: membership.roleId }
  };

  return ok(200, { orgId: membership.orgId, userId: membership.userId, roleId: membership.roleId, event }, meta);
}

import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { onMembershipChanged } from "../hooks";
import { orgTeamRbacMeta } from "../meta";
import type { RbacStore } from "../ports";
import type { DomainEvent } from "../types";

// Remove a member (soft: status -> removed). The last owner cannot be removed.
// Emits member.removed and notifies the cross-module onMembershipChanged observer
// chain.
//
// This use case is framework-neutral: it never imports SvelteKit or Hono.
export async function removeMember(
  orgId: string,
  userId: string,
  deps: {
    store: RbacStore;
    now?: () => number;
    correlationId?: string;
    onMembershipChangedHooks?: ResolvedHook[];
  }
) {
  const meta = orgTeamRbacMeta(deps);

  const membership = await deps.store.getMembership(orgId, userId);
  if (!membership || membership.status !== "active") {
    return err(404, { code: "org-team-rbac.MEMBER_NOT_FOUND", message: "Active membership not found." }, meta);
  }

  const role = await deps.store.getRole(membership.roleId);
  if (role?.permissions.includes("*")) {
    const owners = await deps.store.countOwners(orgId);
    if (owners <= 1) {
      return err(409, { code: "org-team-rbac.LAST_OWNER", message: "Cannot remove the last owner." }, meta);
    }
  }

  membership.status = "removed";
  membership.updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  await deps.store.updateMembership(membership);

  await onMembershipChanged({ action: "removed", membership });
  await runHooks(
    "onMembershipChanged",
    { action: "removed" as const, membership },
    { correlationId: meta.correlationId },
    deps.onMembershipChangedHooks ?? []
  );

  const event: DomainEvent = {
    name: "member.removed",
    correlationId: meta.correlationId,
    payload: { orgId, userId, membershipId: membership.id }
  };

  return ok(200, { orgId, userId, status: "removed" as const, event }, meta);
}

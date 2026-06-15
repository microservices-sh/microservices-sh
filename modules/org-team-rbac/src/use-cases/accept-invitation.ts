import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { onMembershipChanged } from "../hooks";
import { acceptInvitationInputSchema } from "../schemas";
import { orgTeamRbacMeta } from "../meta";
import type { RbacStore } from "../ports";
import type { DomainEvent, Membership } from "../types";

// Accept an invitation: single-use (status must be pending) and time-boxed
// (expired tokens are rejected and marked). These two checks are the invitation
// failure agents skip — tokens that work forever and can be replayed. Emits
// member.joined when a new membership becomes active.
//
// The cross-module `onMembershipChanged` observer chain (Plan 25 §5) is notified
// after a join so other modules can react (e.g. provision a seat, send a
// welcome). Observers cannot veto.
//
// This use case is framework-neutral: it never imports SvelteKit or Hono.
export async function acceptInvitation(
  input: unknown,
  deps: {
    store: RbacStore;
    now?: () => number;
    correlationId?: string;
    onMembershipChangedHooks?: ResolvedHook[];
  }
) {
  const meta = orgTeamRbacMeta(deps);

  const parsed = acceptInvitationInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "org-team-rbac.INVALID_ACCEPT_INPUT", message: "Accept input is invalid.", issues: parsed.error.issues }, meta);
  }

  const invitation = await deps.store.getInvitationByToken(parsed.data.token);
  if (!invitation) {
    return err(404, { code: "org-team-rbac.INVITATION_NOT_FOUND", message: "Invitation not found." }, meta);
  }
  if (invitation.status !== "pending") {
    return err(409, { code: "org-team-rbac.INVITATION_USED", message: `Invitation is ${invitation.status}.` }, meta);
  }

  const nowMs = deps.now?.() ?? Date.now();
  if (Date.parse(invitation.expiresAt) <= nowMs) {
    invitation.status = "expired";
    await deps.store.updateInvitation(invitation);
    return err(410, { code: "org-team-rbac.INVITATION_EXPIRED", message: "Invitation has expired." }, meta);
  }

  const nowIso = new Date(nowMs).toISOString();
  const existing = await deps.store.getMembership(invitation.orgId, parsed.data.userId);
  if (existing && existing.status === "active") {
    invitation.status = "accepted";
    await deps.store.updateInvitation(invitation);
    return ok(200, { orgId: invitation.orgId, membershipId: existing.id, alreadyMember: true }, meta);
  }

  const membership: Membership = existing
    ? { ...existing, roleId: invitation.roleId, status: "active", updatedAt: nowIso }
    : {
        id: "mem_" + crypto.randomUUID().slice(0, 16),
        orgId: invitation.orgId,
        userId: parsed.data.userId,
        roleId: invitation.roleId,
        status: "active",
        createdAt: nowIso,
        updatedAt: nowIso
      };
  if (existing) await deps.store.updateMembership(membership);
  else await deps.store.insertMembership(membership);

  invitation.status = "accepted";
  await deps.store.updateInvitation(invitation);

  await onMembershipChanged({ action: "joined", membership });
  await runHooks(
    "onMembershipChanged",
    { action: "joined" as const, membership },
    { correlationId: meta.correlationId },
    deps.onMembershipChangedHooks ?? []
  );

  const event: DomainEvent = {
    name: "member.joined",
    correlationId: meta.correlationId,
    payload: { orgId: invitation.orgId, userId: membership.userId, membershipId: membership.id, roleId: membership.roleId }
  };

  return ok(201, { orgId: invitation.orgId, membershipId: membership.id, event }, meta);
}

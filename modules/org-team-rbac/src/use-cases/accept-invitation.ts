import { onMembershipChanged } from "../hooks";
import { acceptInvitationInputSchema } from "../schemas";
import type { RbacStore } from "../ports";
import type { Membership } from "../types";

// Accept an invitation: single-use (status must be pending) and time-boxed
// (expired tokens are rejected and marked). These two checks are the invitation
// failure agents skip — tokens that work forever and can be replayed.
export async function acceptInvitation(input: unknown, deps: { store: RbacStore; now?: () => number }) {
  const parsed = acceptInvitationInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "INVALID_ACCEPT_INPUT", message: "Accept input is invalid.", issues: parsed.error.issues } };
  }

  const invitation = await deps.store.getInvitationByToken(parsed.data.token);
  if (!invitation) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "INVITATION_NOT_FOUND", message: "Invitation not found." } };
  }
  if (invitation.status !== "pending") {
    return { ok: false as const, status: 409 as const, data: null, error: { code: "INVITATION_USED", message: `Invitation is ${invitation.status}.` } };
  }

  const nowMs = deps.now?.() ?? Date.now();
  if (Date.parse(invitation.expiresAt) <= nowMs) {
    invitation.status = "expired";
    await deps.store.updateInvitation(invitation);
    return { ok: false as const, status: 410 as const, data: null, error: { code: "INVITATION_EXPIRED", message: "Invitation has expired." } };
  }

  const nowIso = new Date(nowMs).toISOString();
  const existing = await deps.store.getMembership(invitation.orgId, parsed.data.userId);
  if (existing && existing.status === "active") {
    invitation.status = "accepted";
    await deps.store.updateInvitation(invitation);
    return { ok: true as const, status: 200 as const, data: { orgId: invitation.orgId, membershipId: existing.id, alreadyMember: true } };
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

  return { ok: true as const, status: 201 as const, data: { orgId: invitation.orgId, membershipId: membership.id } };
}

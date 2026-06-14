import { defaultConfig } from "../config";
import { beforeInvite } from "../hooks";
import { inviteMemberInputSchema } from "../schemas";
import type { RbacStore } from "../ports";
import type { Invitation } from "../types";

// Create a single-use, expiring invitation. The role must belong to the org
// (cross-tenant role ids are rejected). The returned token is what the invitee
// presents to acceptInvitation.
export async function inviteMember(
  input: unknown,
  deps: { store: RbacStore; now?: () => number; config?: Partial<typeof defaultConfig>; token?: () => string }
) {
  const parsed = inviteMemberInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "INVALID_INVITE_INPUT", message: "Invite input is invalid.", issues: parsed.error.issues } };
  }

  const org = await deps.store.getOrg(parsed.data.orgId);
  if (!org) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "ORG_NOT_FOUND", message: "Organization not found." } };
  }
  const role = await deps.store.getRole(parsed.data.roleId);
  if (!role || role.orgId !== parsed.data.orgId) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "INVALID_ROLE", message: "Role does not belong to this organization." } };
  }

  const hooked = await beforeInvite(parsed.data);
  if (!hooked) {
    return { ok: false as const, status: 409 as const, data: null, error: { code: "INVITE_BLOCKED", message: "Invite was blocked by beforeInvite." } };
  }

  const cfg = { ...defaultConfig, ...deps.config };
  const nowMs = deps.now?.() ?? Date.now();
  const token = deps.token?.() ?? (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");

  const invitation: Invitation = {
    id: "inv_" + crypto.randomUUID().slice(0, 16),
    orgId: hooked.orgId,
    email: hooked.email.toLowerCase(),
    roleId: hooked.roleId,
    token,
    status: "pending",
    expiresAt: new Date(nowMs + cfg.invitationTtlMs).toISOString(),
    createdAt: new Date(nowMs).toISOString()
  };
  await deps.store.insertInvitation(invitation);

  return { ok: true as const, status: 201 as const, data: { id: invitation.id, token, expiresAt: invitation.expiresAt } };
}

import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { defaultConfig } from "../config";
import { beforeInvite } from "../hooks";
import { inviteMemberInputSchema } from "../schemas";
import type { InviteMemberInput } from "../schemas";
import { orgTeamRbacMeta } from "../meta";
import type { RbacStore } from "../ports";
import type { DomainEvent, Invitation } from "../types";

// Create a single-use, expiring invitation. The role must belong to the org
// (cross-tenant role ids are rejected). The returned token is what the invitee
// presents to acceptInvitation. Emits member.invited.
//
// Two layers of customization run before the invitation is persisted:
//   1. the local config seam `beforeInvite` (per-app override, may block)
//   2. the cross-module `beforeInvite` hook chain (Plan 25 §5), injected by the
//      composed app via deps.beforeInviteHooks — filters may mutate the input
//      (e.g. domain allowlist), guards may veto.
//
// This use case is framework-neutral: it never imports SvelteKit or Hono.
export async function inviteMember(
  input: unknown,
  deps: {
    store: RbacStore;
    now?: () => number;
    config?: Partial<typeof defaultConfig>;
    token?: () => string;
    correlationId?: string;
    beforeInviteHooks?: ResolvedHook[];
  }
) {
  const meta = orgTeamRbacMeta(deps);

  const parsed = inviteMemberInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "org-team-rbac.INVALID_INVITE_INPUT", message: "Invite input is invalid.", issues: parsed.error.issues }, meta);
  }

  const org = await deps.store.getOrg(parsed.data.orgId);
  if (!org) {
    return err(404, { code: "org-team-rbac.ORG_NOT_FOUND", message: "Organization not found." }, meta);
  }
  const role = await deps.store.getRole(parsed.data.roleId);
  if (!role || role.orgId !== parsed.data.orgId) {
    return err(400, { code: "org-team-rbac.INVALID_ROLE", message: "Role does not belong to this organization." }, meta);
  }

  const configData = await beforeInvite(parsed.data);
  if (!configData) {
    return err(409, { code: "org-team-rbac.INVITE_BLOCKED", message: "Invite was blocked by beforeInvite." }, meta);
  }

  const hookRun = await runHooks(
    "beforeInvite",
    configData,
    { correlationId: meta.correlationId },
    deps.beforeInviteHooks ?? []
  );
  if (!hookRun.ok) {
    return err(hookRun.status, hookRun.error, meta);
  }
  const hooked = hookRun.value as InviteMemberInput;

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

  const event: DomainEvent = {
    name: "member.invited",
    correlationId: meta.correlationId,
    payload: { invitationId: invitation.id, orgId: invitation.orgId, email: invitation.email, roleId: invitation.roleId }
  };

  return ok(201, { id: invitation.id, token, expiresAt: invitation.expiresAt, event }, meta);
}

import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listMembers, inviteMember, updateMemberRole, authorize } from "@microservices-sh/org-team-rbac";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("org-team-rbac", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  // Reading the roster only needs org.read; managing members needs member.manage.
  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const [members, roles, invitations] = await Promise.all([
    listMembers(activeOrgId, { store: locals.rbacStore }),
    locals.rbacStore.listRoles(activeOrgId),
    locals.rbacStore.listInvitations(activeOrgId)
  ]);

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    members: members.data.members,
    roles: roles.map((role) => ({ id: role.id, name: role.name })),
    invitations: invitations
      .filter((inv) => inv.status === "pending")
      .map((inv) => ({ id: inv.id, email: inv.email, token: inv.token, expiresAt: inv.expiresAt }))
  };
};

async function gateManage(locals: App.Locals, orgId: string) {
  return authorize(orgId, locals.user!.id, "member.manage", { store: locals.rbacStore });
}

export const actions: Actions = {
  invite: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in." });
    // Derive the org from the session-bound company context (membership-revalidated),
    // NOT from the form — a client-supplied orgId must never be trusted.
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org || !(await gateManage(locals, org.id)).ok) return fail(403, { error: "You do not have permission to invite members." });
    const orgId = org.id;
    const form = await request.formData();

    const result = await inviteMember(
      { orgId, email: String(form.get("email") ?? ""), roleId: String(form.get("roleId") ?? "") },
      { store: locals.rbacStore }
    );
    if (!result.ok) return fail(result.status, { error: result.error?.message ?? "Invite failed." });

    await recordEvent(
      { eventName: "member.invited", actorId: locals.user.id, entityType: "organization", entityId: orgId, source: "team", payload: { invitationId: result.data.id } },
      { auditStore: locals.auditStore }
    );
    return { ok: true, invited: true, token: result.data.token };
  },

  changeRole: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org || !(await gateManage(locals, org.id)).ok) return fail(403, { error: "You do not have permission to change roles." });
    const orgId = org.id;
    const form = await request.formData();

    const result = await updateMemberRole(
      { orgId, userId: String(form.get("userId") ?? ""), roleId: String(form.get("roleId") ?? "") },
      { store: locals.rbacStore }
    );
    if (!result.ok) return fail(result.status, { error: result.error?.message ?? "Role change failed." });

    await recordEvent(
      { eventName: "role.updated", actorId: locals.user.id, entityType: "membership", entityId: result.data.userId, source: "team", payload: { roleId: result.data.roleId } },
      { auditStore: locals.auditStore }
    );
    return { ok: true, roleChanged: true };
  }
};

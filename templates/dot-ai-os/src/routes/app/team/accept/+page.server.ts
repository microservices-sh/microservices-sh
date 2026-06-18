import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { acceptInvitation } from "@microservices-sh/org-team-rbac";
import { recordEvent } from "@microservices-sh/audit-log";
import { rememberWorkspaceOrg } from "$lib/server/org-context";

export const load: PageServerLoad = async ({ url, locals }) => {
  if (!locals.user) throw redirect(303, "/login");
  return { token: url.searchParams.get("token") ?? "" };
};

export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    if (!locals.user) throw redirect(303, "/login");
    const form = await request.formData();
    const token = String(form.get("token") ?? "");

    // Single-use, time-boxed accept: the use case rejects replayed and expired
    // tokens. On success the user becomes an active member of that org.
    const result = await acceptInvitation({ token, userId: locals.user.id }, { store: locals.rbacStore });
    if (!result.ok) return fail(result.status, { error: result.error?.message ?? "Could not accept invitation." });

    await recordEvent(
      { eventName: "member.joined", actorId: locals.user.id, entityType: "organization", entityId: result.data.orgId, source: "accept-invitation", payload: {} },
      { auditStore: locals.auditStore }
    );

    rememberWorkspaceOrg(cookies, result.data.orgId);
    throw redirect(303, "/app");
  }
};

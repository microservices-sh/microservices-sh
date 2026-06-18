import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { updateOrganization } from "@microservices-sh/org-team-rbac";
import { listEvents, recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission } from "$lib/server/org-context";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export const load: PageServerLoad = async ({ locals, parent }) => {
  const { activeOrg, activeOrgId, permissions } = await parent();
  if (!activeOrgId || !activeOrg || !locals.user) throw redirect(303, "/app");

  // Recent activity for this org from the audit trail, scoped by entity id.
  const activity = await listEvents({ entityId: activeOrgId, limit: 10 }, { auditStore: locals.auditStore });

  return {
    org: activeOrg,
    user: locals.user,
    permissions,
    // org.manage (admins) or "*" (owner) may rename the company.
    canManage: permissions.includes("*") || permissions.includes("org.manage"),
    activity: activity.ok
      ? activity.data.events.map((event) => ({ eventName: event.eventName, createdAt: event.createdAt, source: event.source }))
      : []
  };
};

export const actions: Actions = {
  // Rename the company / change its workspace slug via the org-team-rbac use case
  // (the route never touches the store adapter directly). Slug uniqueness and
  // validation live in the module; here we just gate, shape, and audit.
  rename: async ({ request, locals, cookies, parent }) => {
    const { activeOrgId } = await parent();
    if (!activeOrgId || !locals.user) return fail(403, { error: "Not signed in to a company." });

    await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.manage", locals.rbacStore);

    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const slug = slugify(String(form.get("slug") ?? "") || name);
    const values = { name, slug };

    if (!name) return fail(400, { error: "Enter a company name.", values });
    if (!slug) return fail(400, { error: "Enter a valid workspace URL.", values });

    const result = await updateOrganization({ orgId: activeOrgId, name, slug }, { store: locals.rbacStore });
    if (!result.ok || !result.data) {
      return fail(result.status ?? 400, { error: result.error?.message ?? "Could not update the company.", values });
    }

    await recordEvent(
      {
        eventName: "org.updated",
        actorId: locals.user.id,
        entityType: "organization",
        entityId: activeOrgId,
        source: "app/settings",
        payload: { name: result.data.name, slug: result.data.slug }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, renamed: true };
  }
};

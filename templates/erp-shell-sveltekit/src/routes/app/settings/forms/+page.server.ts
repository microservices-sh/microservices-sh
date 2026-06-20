import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listFormsScoped, createFormScoped, authContext } from "@microservices-sh/forms-intake";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

// Settings hub: intake form creation (configuration / the builder) for
// @microservices-sh/forms-intake. Operational submission review stays on
// /app/forms.
export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("forms-intake", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const ctx = authContext({ orgId: activeOrgId, actorId: locals.user.id, roles: permissions });
  const formsResult = await listFormsScoped(ctx, {}, { formStore: locals.formStore });
  const forms = formsResult.ok ? formsResult.data.forms : [];

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    forms: forms.map((f) => ({ id: f.id, name: f.name, status: f.status, fieldCount: f.fields.length, createdAt: f.createdAt }))
  };
};

export const actions: Actions = {
  createForm: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);
    const ctx = authContext({ orgId: org.id, actorId: locals.user.id, roles: permissions });

    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const requireTurnstile = form.get("requireTurnstile") === "on";
    if (!name) return fail(400, { error: "Enter a form name." });

    // Fields start empty — a real form is built up via updateForm; this sample
    // creates the form shell so submissions can be wired against it. Enforced
    // boundary (plan 33): the form's tenant is stamped from the session org.
    const result = await createFormScoped(
      ctx,
      { name, fields: [], requireTurnstile },
      { formStore: locals.formStore }
    );
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not create the form." });

    await recordEvent(
      { eventName: "forms-intake.form_created", actorId: locals.user.id, entityType: "form", entityId: result.data.id, source: "app/forms", payload: { name } },
      { auditStore: locals.auditStore }
    );
    return { ok: true, created: true };
  }
};

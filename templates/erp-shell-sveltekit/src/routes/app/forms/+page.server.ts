import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listForms, listSubmissions } from "@microservices-sh/forms-intake";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

// Reference UI for @microservices-sh/forms-intake: review form submissions.
// Form creation (the builder) lives in the Settings hub (/app/settings/forms);
// this surface keeps a read-only forms list so a form can be selected. Public
// submission (submitForm, Turnstile-gated) is an end-user surface and lives
// outside this admin sample. Submissions are listed per form (the module
// requires a formId so one form's data can't leak via another's id); pass
// ?form=<id> to view a form's submissions.
export const load: PageServerLoad = async ({ locals, cookies, parent, platform, url }) => {
  requireModule("forms-intake", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const formsResult = await listForms({ tenantId: activeOrgId }, { formStore: locals.formStore });
  const forms = formsResult.ok ? formsResult.data.forms : [];

  const selectedFormId = url.searchParams.get("form");
  let submissions: Array<{ id: string; values: Record<string, unknown>; submittedAt: string }> = [];
  if (selectedFormId && forms.some((f) => f.id === selectedFormId)) {
    const subsResult = await listSubmissions({ tenantId: activeOrgId, formId: selectedFormId }, { formStore: locals.formStore });
    if (subsResult.ok) {
      submissions = subsResult.data.submissions.map((s) => ({ id: s.id, values: s.values, submittedAt: s.submittedAt }));
    }
  }

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    forms: forms.map((f) => ({ id: f.id, name: f.name, status: f.status, fieldCount: f.fields.length, createdAt: f.createdAt })),
    selectedFormId: selectedFormId ?? null,
    submissions
  };
};

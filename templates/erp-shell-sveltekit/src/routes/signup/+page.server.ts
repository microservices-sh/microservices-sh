import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { createOrganization } from "@microservices-sh/org-team-rbac";
import { recordEvent } from "@microservices-sh/audit-log";
import { writeSession, userIdForEmail, isSuperAdminEmail } from "$lib/server/session";
import { rememberCompanyOrg } from "$lib/server/org-context";

// One-time company setup. In a single-company ERP this is NOT a public tenant
// funnel: it creates the one company org and makes the first user its owner.
// After setup, /app routes employees straight into the shell.
export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(303, "/app");
  return {};
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export const actions: Actions = {
  default: async ({ request, cookies, locals }) => {
    const formData = await request.formData();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const orgName = String(formData.get("orgName") ?? "").trim();
    const slug = slugify(String(formData.get("slug") ?? orgName));
    const values = { email, orgName, slug };

    if (!email || !email.includes("@")) {
      return fail(400, { error: "Enter a valid email address.", values });
    }
    if (!orgName) {
      return fail(400, { error: "Enter a company name.", values });
    }

    const userId = userIdForEmail(email);

    // The org-team-rbac use case creates the company org, seeds owner/admin/member
    // roles, and makes this user the owner — all in one framework-neutral call.
    const result = await createOrganization(
      { name: orgName, slug, ownerUserId: userId },
      { store: locals.rbacStore }
    );

    if (!result.ok) {
      return fail(result.status, { error: result.error?.message ?? "Could not create the company.", values });
    }

    await recordEvent(
      { eventName: "org.created", actorId: userId, entityType: "organization", entityId: result.data.id, source: "setup", payload: { slug: result.data.slug } },
      { auditStore: locals.auditStore }
    );

    writeSession(cookies, { id: userId, email, isSuperAdmin: isSuperAdminEmail(email) });
    rememberCompanyOrg(cookies, result.data.id);

    throw redirect(303, "/app");
  }
};

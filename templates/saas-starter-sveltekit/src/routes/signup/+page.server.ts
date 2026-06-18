import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { createOrganization } from "@microservices-sh/org-team-rbac";
import { requestLoginCode, verifyLoginCode } from "@microservices-sh/identity";
import { recordEvent } from "@microservices-sh/audit-log";
import { adminEmailsFor, setSessionCookie } from "$lib/server/session";
import { rememberOrg } from "$lib/server/org-context";

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
  default: async ({ request, cookies, locals, platform }) => {
    const formData = await request.formData();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const orgName = String(formData.get("orgName") ?? "").trim();
    const slug = slugify(String(formData.get("slug") ?? orgName));
    const values = { email, orgName, slug };

    if (!email || !email.includes("@")) {
      return fail(400, { error: "Enter a valid email address.", values });
    }
    if (!orgName) {
      return fail(400, { error: "Enter an organization name.", values });
    }

    const codeResult = await requestLoginCode(
      { email },
      { accountStore: locals.accountStore, loginCodeStore: locals.loginCodeStore, adminEmails: adminEmailsFor(platform) }
    );
    if (!codeResult.ok) {
      return fail(codeResult.status, { error: codeResult.error?.message ?? "Could not start signup.", values });
    }

    const verifyResult = await verifyLoginCode(
      { email, code: codeResult.data.code },
      { accountStore: locals.accountStore, loginCodeStore: locals.loginCodeStore, sessionStore: locals.sessionStore }
    );
    if (!verifyResult.ok) {
      return fail(verifyResult.status, { error: verifyResult.error?.message ?? "Could not start signup.", values });
    }
    const userId = verifyResult.data.user.id;

    // The org-team-rbac use case creates the org, seeds owner/admin/member roles,
    // and makes this user the owner — all in one framework-neutral call.
    const result = await createOrganization(
      { name: orgName, slug, ownerUserId: userId },
      { store: locals.rbacStore }
    );

    if (!result.ok) {
      return fail(result.status, { error: result.error?.message ?? "Could not create organization.", values });
    }

    await recordEvent(
      { eventName: "org.created", actorId: userId, entityType: "organization", entityId: result.data.id, source: "signup", payload: { slug: result.data.slug } },
      { auditStore: locals.auditStore }
    );

    setSessionCookie(cookies, verifyResult.data.sessionId);
    rememberOrg(cookies, result.data.id);

    throw redirect(303, "/app");
  }
};

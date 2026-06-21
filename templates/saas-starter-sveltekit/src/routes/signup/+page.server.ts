import type { Actions, PageServerLoad } from "./$types";
import { dev } from "$app/environment";
import { fail, redirect } from "@sveltejs/kit";
import { createOrganization } from "@microservices-sh/org-team-rbac";
import { requestLoginCode, verifyLoginCode } from "@microservices-sh/identity";
import { sendEmail } from "@microservices-sh/email";
import { recordEvent } from "@microservices-sh/audit-log";
import { getEmailDeps } from "$lib/server/email-deps";
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

function readDetails(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const orgName = String(formData.get("orgName") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? orgName));
  return { email, orgName, slug, values: { email, orgName, slug } };
}

export const actions: Actions = {
  // Step 1 — validate and EMAIL a confirmation code. Creates no account, org, or
  // session: the code must round-trip through the user's inbox before anything is
  // created (step 2). This is the email-ownership proof for passwordless signup.
  request: async ({ request, locals, platform }) => {
    const { email, orgName, values } = readDetails(await request.formData());
    if (!email || !email.includes("@")) return fail(400, { error: "Enter a valid email address.", values });
    if (!orgName) return fail(400, { error: "Enter an organization name.", values });

    const limit = await locals.rateLimitStore.hit("signup:request:" + email, 5, 600);
    if (!limit.allowed) return fail(429, { error: "Too many attempts. Try again in a few minutes.", values });

    const codeResult = await requestLoginCode(
      { email },
      { accountStore: locals.accountStore, loginCodeStore: locals.loginCodeStore, adminEmails: adminEmailsFor(platform) }
    );
    if (!codeResult.ok) return fail(codeResult.status, { error: codeResult.error?.message ?? "Could not start signup.", values });

    const { provider, emailRepository, from } = getEmailDeps(platform?.env?.DB, platform?.env);
    const minutes = Math.round(codeResult.data.expiresInSeconds / 60);
    await sendEmail(
      {
        from,
        to: [codeResult.data.email],
        subject: "Confirm your email to finish signing up",
        html: `<p>Your confirmation code is <strong>${codeResult.data.code}</strong>. It expires in ${minutes} minutes.</p>`,
        text: `Your confirmation code is ${codeResult.data.code} (expires in ${minutes} minutes).`,
        idempotencyKey: `signup:${codeResult.data.email}:${codeResult.data.code}`
      },
      { provider, emailRepository }
    );

    // devCode is surfaced only in dev so local signups don't need a real inbox —
    // never in production, where the code must come from the user's email.
    return { step: "verify" as const, values, ...(dev ? { devCode: codeResult.data.code } : {}) };
  },

  // Step 2 — the user submits the code FROM their email. Only now do we verify it,
  // create the account + organization, and start a session. The code is never
  // sourced server-side: a forged email cannot complete signup without the inbox.
  verify: async ({ request, cookies, locals }) => {
    const formData = await request.formData();
    const { email, orgName, slug, values } = readDetails(formData);
    const code = String(formData.get("code") ?? "").trim();

    if (!email || !orgName) return fail(400, { error: "Your details were lost — start again.", values });
    if (!code) return fail(400, { step: "verify" as const, error: "Enter the code from your email.", values });

    const verifyResult = await verifyLoginCode(
      { email, code },
      { accountStore: locals.accountStore, loginCodeStore: locals.loginCodeStore, sessionStore: locals.sessionStore }
    );
    if (!verifyResult.ok) {
      return fail(verifyResult.status, { step: "verify" as const, error: verifyResult.error?.message ?? "That code is invalid or expired.", values });
    }
    const userId = verifyResult.data.user.id;

    // The org-team-rbac use case creates the org, seeds owner/admin/member roles,
    // and makes this user the owner — all in one framework-neutral call.
    const result = await createOrganization(
      { name: orgName, slug, ownerUserId: userId },
      { store: locals.rbacStore }
    );
    if (!result.ok) return fail(result.status, { error: result.error?.message ?? "Could not create organization.", values });

    await recordEvent(
      { eventName: "org.created", actorId: userId, entityType: "organization", entityId: result.data.id, source: "signup", payload: { slug: result.data.slug } },
      { auditStore: locals.auditStore }
    );

    setSessionCookie(cookies, verifyResult.data.sessionId);
    rememberOrg(cookies, result.data.id);
    throw redirect(303, "/app");
  }
};

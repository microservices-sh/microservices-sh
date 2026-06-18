import { json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import type { RequestHandler } from "./$types";
import { requestLoginCode, verifyLoginCode, destroySession } from "@microservices-sh/identity";
import { sendEmail } from "@microservices-sh/email";
import { getEmailDeps } from "$lib/server/email-deps";
import { adminEmailsFor, resolvePortalUser, setSessionCookie } from "$lib/server/session";

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

async function canRequestPortalCode(email: string, locals: App.Locals, platform: App.Platform | undefined) {
  if (adminEmailsFor(platform).includes(email)) return true;
  const customer = await locals.customerRepository.findCustomerByEmail(email);
  return Boolean(customer);
}

export const POST: RequestHandler = async ({ request, platform, locals, cookies }) => {
  const body = (await request.json()) as { action?: string; email?: string; code?: string };
  const email = normalizeEmail(body.email);

  if (body.action === "request") {
    if (email) {
      const limit = await locals.rateLimitStore.hit(`login:request:${email}`, 5, 600);
      if (!limit.allowed) {
        return json(
          { ok: false, error: { code: "identity.RATE_LIMITED", message: "Too many sign-in attempts. Try again later." } },
          { status: 429 }
        );
      }
    }

    if (!email || !(await canRequestPortalCode(email, locals, platform))) {
      return json(
        { ok: false, error: { code: "portal.ACCOUNT_NOT_FOUND", message: "No portal account was found for that email." } },
        { status: 404 }
      );
    }

    const res = await requestLoginCode(
      { email },
      { accountStore: locals.accountStore, loginCodeStore: locals.loginCodeStore, adminEmails: adminEmailsFor(platform) }
    );
    if (!res.ok) return json({ ok: false, error: res.error }, { status: res.status });

    const { provider, emailRepository, from } = getEmailDeps(platform?.env?.DB, platform?.env);
    const minutes = Math.round(res.data.expiresInSeconds / 60);
    await sendEmail(
      {
        from,
        to: [res.data.email],
        subject: "Your client portal sign-in code",
        html: `<p>Your client portal sign-in code is <strong>${res.data.code}</strong>. It expires in ${minutes} minutes.</p>`,
        text: `Your client portal sign-in code is ${res.data.code} (expires in ${minutes} minutes).`,
        idempotencyKey: `client-portal-login:${res.data.email}:${res.data.code}`
      },
      { provider, emailRepository }
    );

    return json({ ok: true, ...(dev ? { devCode: res.data.code } : {}) });
  }

  if (body.action === "verify") {
    const res = await verifyLoginCode(
      { email, code: body.code },
      { accountStore: locals.accountStore, loginCodeStore: locals.loginCodeStore, sessionStore: locals.sessionStore }
    );
    if (!res.ok) return json({ ok: false, error: res.error }, { status: res.status });

    const user = await resolvePortalUser(res.data.user, { customerRepository: locals.customerRepository });
    if (!user) {
      await destroySession({ sessionId: res.data.sessionId }, { sessionStore: locals.sessionStore });
      return json(
        { ok: false, error: { code: "portal.ACCESS_DENIED", message: "That email is not assigned to a portal customer or staff role." } },
        { status: 403 }
      );
    }

    setSessionCookie(cookies, res.data.sessionId);
    return json({ ok: true, user, redirectTo: user.role === "staff" ? "/admin" : "/portal" });
  }

  return json({ ok: false, error: { code: "identity.BAD_ACTION", message: "Unknown action." } }, { status: 400 });
};

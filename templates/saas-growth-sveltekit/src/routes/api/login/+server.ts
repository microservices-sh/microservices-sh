import { json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import type { RequestHandler } from "./$types";
import { requestLoginCode, verifyLoginCode } from "@microservices-sh/identity";
import { sendEmail } from "@microservices-sh/email";
import { getEmailDeps } from "$lib/server/email-deps";
import { adminEmailsFor, setSessionCookie } from "$lib/server/session";

export const POST: RequestHandler = async ({ request, platform, locals, cookies }) => {
  const body = (await request.json()) as { action?: string; email?: string; code?: string };

  if (body.action === "request") {
    if (body.email) {
      const identifier = "login:request:" + String(body.email).trim().toLowerCase();
      const limit = await locals.rateLimitStore.hit(identifier, 5, 600);
      if (!limit.allowed) {
        return json(
          { ok: false, error: { code: "identity.RATE_LIMITED", message: "Too many sign-in attempts. Try again later." } },
          { status: 429 }
        );
      }
    }

    const result = await requestLoginCode(
      { email: body.email },
      { accountStore: locals.accountStore, loginCodeStore: locals.loginCodeStore, adminEmails: adminEmailsFor(platform) }
    );
    if (!result.ok) return json({ ok: false, error: result.error }, { status: result.status });

    const { provider, emailRepository, from } = getEmailDeps(platform?.env?.DB, platform?.env);
    const minutes = Math.round(result.data.expiresInSeconds / 60);
    await sendEmail(
      {
        from,
        to: [result.data.email],
        subject: "Your sign-in code",
        html: `<p>Your sign-in code is <strong>${result.data.code}</strong>. It expires in ${minutes} minutes.</p>`,
        text: `Your sign-in code is ${result.data.code} (expires in ${minutes} minutes).`,
        idempotencyKey: `login:${result.data.email}:${result.data.code}`
      },
      { provider, emailRepository }
    );

    return json({ ok: true, ...(dev ? { devCode: result.data.code } : {}) });
  }

  if (body.action === "verify") {
    const result = await verifyLoginCode(
      { email: body.email, code: body.code },
      { accountStore: locals.accountStore, loginCodeStore: locals.loginCodeStore, sessionStore: locals.sessionStore }
    );
    if (!result.ok) return json({ ok: false, error: result.error }, { status: result.status });
    setSessionCookie(cookies, result.data.sessionId);
    return json({ ok: true, user: result.data.user });
  }

  return json({ ok: false, error: { code: "identity.BAD_ACTION", message: "Unknown action." } }, { status: 400 });
};

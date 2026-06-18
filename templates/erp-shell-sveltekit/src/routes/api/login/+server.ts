import { json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import type { RequestHandler } from "./$types";
import { requestLoginCode, verifyLoginCode } from "@microservices-sh/identity";
import { sendEmail } from "@microservices-sh/email";
import { getEmailDeps } from "$lib/server/email-deps";
import { setSessionCookie, adminEmailsFor } from "$lib/server/session";

// Passwordless email-code login. The /login page posts here in two steps:
//   { action: "request", email }        → mint + email a one-time code
//   { action: "verify", email, code }   → verify, open a server session, set cookie
//
// Stores come from locals (D1 in prod, memory locally). The code is hashed at
// rest; the plaintext is only ever returned to this handler to hand to email.
export const POST: RequestHandler = async ({ request, platform, locals, cookies }) => {
  const body = (await request.json()) as { action?: string; email?: string; code?: string };

  if (body.action === "request") {
    const res = await requestLoginCode(
      { email: body.email },
      { accountStore: locals.accountStore, loginCodeStore: locals.loginCodeStore, adminEmails: adminEmailsFor(platform) }
    );
    if (!res.ok) return json({ ok: false, error: res.error }, { status: res.status });

    // Deliver the code by email. Dev also echoes it so local testing needs no inbox.
    const { provider, emailRepository, from } = getEmailDeps(platform?.env?.DB, platform?.env);
    const minutes = Math.round(res.data.expiresInSeconds / 60);
    await sendEmail(
      {
        from,
        to: [res.data.email],
        subject: "Your sign-in code",
        html: `<p>Your sign-in code is <strong>${res.data.code}</strong>. It expires in ${minutes} minutes.</p>`,
        text: `Your sign-in code is ${res.data.code} (expires in ${minutes} minutes).`,
        idempotencyKey: `login:${res.data.email}:${res.data.code}`
      },
      { provider, emailRepository }
    );
    return json({ ok: true, ...(dev ? { devCode: res.data.code } : {}) });
  }

  if (body.action === "verify") {
    const res = await verifyLoginCode(
      { email: body.email, code: body.code },
      { accountStore: locals.accountStore, loginCodeStore: locals.loginCodeStore, sessionStore: locals.sessionStore }
    );
    if (!res.ok) return json({ ok: false, error: res.error }, { status: res.status });
    setSessionCookie(cookies, res.data.sessionId);
    return json({ ok: true, user: res.data.user });
  }

  return json({ ok: false, error: { code: "identity.BAD_ACTION", message: "Unknown action." } }, { status: 400 });
};

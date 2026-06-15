import { json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import type { RequestHandler } from "./$types";
import {
  requestLoginCode,
  verifyLoginCode,
  serializeSessionCookie,
  createD1AccountStore,
  createD1LoginCodeStore,
  createD1SessionStore
} from "@microservices-sh/identity";
import { sendEmail } from "@microservices-sh/email";
import { getEmailDeps } from "$lib/server/email-deps";

// Comma-separated bootstrap admin emails (env ADMIN_EMAILS). These accounts are
// provisioned with isAdmin on first login. Replace with an invite/role flow later.
function adminEmails(env: Record<string, string | undefined> | undefined): string[] {
  return (env?.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

// Passwordless email-code login (Plan 26). `/login` posts here.
export const POST: RequestHandler = async ({ request, platform }) => {
  const db = platform?.env?.DB;
  if (!db) return json({ ok: false, error: { code: "identity.NO_DB" } }, { status: 503 });
  const accountStore = createD1AccountStore(db);
  const loginCodeStore = createD1LoginCodeStore(db);
  const sessionStore = createD1SessionStore(db);
  const body = await request.json();

  if (body.action === "request") {
    const res = await requestLoginCode({ email: body.email }, { accountStore, loginCodeStore, adminEmails: adminEmails(platform?.env) });
    if (!res.ok) return json({ ok: false, error: res.error }, { status: res.status });
    // Deliver the code by email. Dev also echoes it so local testing needs no inbox.
    const { provider, emailRepository, from } = getEmailDeps(db, platform?.env);
    await sendEmail(
      {
        from,
        to: [res.data.email],
        subject: "Your sign-in code",
        html: `<p>Your sign-in code is <strong>${res.data.code}</strong>. It expires in ${Math.round(res.data.expiresInSeconds / 60)} minutes.</p>`,
        text: `Your sign-in code is ${res.data.code} (expires in ${Math.round(res.data.expiresInSeconds / 60)} minutes).`,
        idempotencyKey: `login:${res.data.email}:${res.data.code}`
      },
      { provider, emailRepository }
    );
    return json({ ok: true, ...(dev ? { devCode: res.data.code } : {}) });
  }

  if (body.action === "verify") {
    const res = await verifyLoginCode({ email: body.email, code: body.code }, { accountStore, loginCodeStore, sessionStore });
    if (!res.ok) return json({ ok: false, error: res.error }, { status: res.status });
    return json(
      { ok: true, user: res.data.user },
      { headers: { "set-cookie": serializeSessionCookie(res.data.sessionId) } }
    );
  }

  return json({ ok: false, error: { code: "identity.BAD_ACTION", message: "Unknown action." } }, { status: 400 });
};

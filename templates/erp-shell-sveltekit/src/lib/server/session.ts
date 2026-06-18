import type { Cookies } from "@sveltejs/kit";
import { dev } from "$app/environment";
import {
  readSession as identityReadSession,
  destroySession,
  SESSION_COOKIE,
  type AccountStore,
  type SessionStore
} from "@microservices-sh/identity";

// ── Real session layer (passwordless identity) ──────────────────────────────
//
// Replaces the old demo HMAC cookie. Sessions are now opaque, server-side records
// owned by @microservices-sh/identity; the cookie carries only the session id.
// The signed-in principal is resolved from the store every request (fail-closed),
// and super-admin is derived from the account's isAdmin flag — never the cookie.

export { SESSION_COOKIE };

export interface SessionUser {
  id: string;
  email: string;
  isSuperAdmin: boolean;
}

export interface IdentityStoreDeps {
  accountStore: AccountStore;
  sessionStore: SessionStore;
}

// Bootstrap admin emails (env ADMIN_EMAILS, comma-separated) get isAdmin on first
// login. A default keeps the starter's super-admin demo working out of the box.
const DEFAULT_ADMIN_EMAILS = ["admin@example.com"];

export function adminEmailsFor(platform: App.Platform | undefined): string[] {
  const env = (platform?.env ?? {}) as { ADMIN_EMAILS?: string };
  const fromEnv = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ADMIN_EMAILS;
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

// Secure cookie except on plain-HTTP local dev (so the session survives over
// http://localhost). SameSite=Lax + httpOnly always.
function cookieOptions() {
  return { path: "/", httpOnly: true, sameSite: "lax" as const, secure: !dev, maxAge: COOKIE_MAX_AGE };
}

export function setSessionCookie(cookies: Cookies, sessionId: string): void {
  cookies.set(SESSION_COOKIE, sessionId, cookieOptions());
}

// Resolve the current user from the session cookie, or null. Re-validated against
// the session store every call; a missing/expired session yields null.
export async function getCurrentUser(cookies: Cookies, deps: IdentityStoreDeps): Promise<SessionUser | null> {
  const sessionId = cookies.get(SESSION_COOKIE);
  if (!sessionId) return null;

  const result = await identityReadSession(
    { sessionId },
    { accountStore: deps.accountStore, sessionStore: deps.sessionStore }
  );
  if (!result.ok || !result.data.user) return null;

  const { id, email, isAdmin } = result.data.user;
  return { id, email, isSuperAdmin: isAdmin };
}

// End the session: delete the server record, then clear the cookie.
export async function endSession(cookies: Cookies, sessionStore: SessionStore): Promise<void> {
  const sessionId = cookies.get(SESSION_COOKIE);
  if (sessionId) await destroySession({ sessionId }, { sessionStore });
  cookies.delete(SESSION_COOKIE, { path: "/" });
}

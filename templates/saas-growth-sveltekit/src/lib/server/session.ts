import type { Cookies } from "@sveltejs/kit";
import { dev } from "$app/environment";
import {
  readSession as identityReadSession,
  destroySession,
  SESSION_COOKIE,
  type AccountStore,
  type SessionStore
} from "@microservices-sh/identity";

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

export function adminEmailsFor(platform: App.Platform | undefined): string[] {
  const env = (platform?.env ?? {}) as { ADMIN_EMAILS?: string };
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function cookieOptions() {
  return { path: "/", httpOnly: true, sameSite: "lax" as const, secure: !dev, maxAge: COOKIE_MAX_AGE };
}

export function setSessionCookie(cookies: Cookies, sessionId: string): void {
  cookies.set(SESSION_COOKIE, sessionId, cookieOptions());
}

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

export async function endSession(cookies: Cookies, sessionStore: SessionStore): Promise<void> {
  const sessionId = cookies.get(SESSION_COOKIE);
  if (sessionId) await destroySession({ sessionId }, { sessionStore });
  cookies.delete(SESSION_COOKIE, { path: "/" });
}

import type { Cookies } from "@sveltejs/kit";

const SESSION_COOKIE = "erp_session";

export interface SessionUser {
  id: string;
  email: string;
  isSuperAdmin: boolean;
}

const cookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30
};

// A demo cookie session. This intentionally avoids a password/JWT exchange so the
// starter runs locally out of the box; swap in @microservices-sh/auth verifyToken
// (already wired through locals.signingKeyStore) for production sign-in.
export function readSession(cookies: Cookies): SessionUser | null {
  const raw = cookies.get(SESSION_COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    if (!parsed.id || !parsed.email) return null;
    return { id: parsed.id, email: parsed.email, isSuperAdmin: Boolean(parsed.isSuperAdmin) };
  } catch {
    return null;
  }
}

export function writeSession(cookies: Cookies, user: SessionUser): void {
  cookies.set(SESSION_COOKIE, JSON.stringify(user), cookieOptions);
}

export function clearSession(cookies: Cookies): void {
  cookies.delete(SESSION_COOKIE, { path: "/" });
}

// Deterministic-ish user id from an email so repeat logins map to one identity in
// the in-memory dev store. Super-admin is granted to the first configured email.
export function userIdForEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return `usr_${hash.toString(16).padStart(8, "0")}`;
}

const SUPER_ADMIN_EMAILS = new Set(["admin@example.com"]);

export function isSuperAdminEmail(email: string): boolean {
  return SUPER_ADMIN_EMAILS.has(email.trim().toLowerCase());
}

import type { Cookies } from "@sveltejs/kit";
import { dev } from "$app/environment";

const SESSION_COOKIE = "saas_session";

export interface SessionUser {
  id: string;
  email: string;
  isSuperAdmin: boolean;
}

// Stored payload — note isSuperAdmin is NOT persisted: it is derived from the
// server-side allowlist on every read, never trusted from the cookie.
interface StoredSession {
  id: string;
  email: string;
}

const SUPER_ADMIN_EMAILS = new Set(["admin@example.com"]);

export function isSuperAdminEmail(email: string): boolean {
  return SUPER_ADMIN_EMAILS.has(email.trim().toLowerCase());
}

// The cookie is signed (HMAC-SHA256) with a server secret so its contents can't
// be forged client-side. Provide SESSION_SECRET via env in production; a dev
// fallback keeps the starter runnable locally. For real auth, swap this whole
// module for the @microservices-sh/auth JWT flow (the JWKS endpoint is wired).
export function getSessionSecret(platform: App.Platform | undefined): string {
  const env = (platform?.env ?? {}) as { SESSION_SECRET?: string };
  return env.SESSION_SECRET ?? "dev-insecure-session-secret-change-me";
}

function cookieOptions() {
  return { path: "/", httpOnly: true, sameSite: "lax" as const, secure: !dev, maxAge: 60 * 60 * 24 * 30 };
}

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(sig));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function readSession(cookies: Cookies, secret: string): Promise<SessionUser | null> {
  const raw = cookies.get(SESSION_COOKIE);
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = raw.slice(0, dot);
  const providedSig = raw.slice(dot + 1);
  const expectedSig = await sign(secret, payload);
  if (!constantTimeEqual(providedSig, expectedSig)) return null; // tampered / unsigned
  try {
    const parsed = JSON.parse(atob(payload)) as Partial<StoredSession>;
    if (!parsed.id || !parsed.email) return null;
    // isSuperAdmin is authoritative from the allowlist, NOT the cookie.
    return { id: parsed.id, email: parsed.email, isSuperAdmin: isSuperAdminEmail(parsed.email) };
  } catch {
    return null;
  }
}

export async function writeSession(cookies: Cookies, user: StoredSession, secret: string): Promise<void> {
  const payload = btoa(JSON.stringify({ id: user.id, email: user.email }));
  const sig = await sign(secret, payload);
  cookies.set(SESSION_COOKIE, `${payload}.${sig}`, cookieOptions());
}

export function clearSession(cookies: Cookies): void {
  cookies.delete(SESSION_COOKIE, { path: "/" });
}

// Deterministic-ish user id from an email so repeat logins map to one identity in
// the in-memory dev store. Super-admin is granted to the configured email(s).
export function userIdForEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return `usr_${hash.toString(16).padStart(8, "0")}`;
}

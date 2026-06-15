import { SESSION_TTL_SECONDS } from "./config";

// httpOnly session cookie carrying the opaque session id. Defaults are safe for
// production (Secure + SameSite=Lax); pass { secure: false } only for plain-HTTP local dev.
export const SESSION_COOKIE = "msh_session";

export function serializeSessionCookie(
  sessionId: string,
  opts: { maxAgeSeconds?: number; secure?: boolean } = {}
): string {
  const parts = [
    `${SESSION_COOKIE}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${opts.maxAgeSeconds ?? SESSION_TTL_SECONDS}`,
  ];
  if (opts.secure ?? true) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(opts: { secure?: boolean } = {}): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (opts.secure ?? true) parts.push("Secure");
  return parts.join("; ");
}

export function parseSessionCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      return part.slice(eq + 1).trim() || null;
    }
  }
  return null;
}

// Auth gate for scheduled endpoints. Fail CLOSED: if CRON_TOKEN is not set the
// endpoint refuses (no open-by-default), and the token is compared in constant
// time to avoid leaking it via timing. Set CRON_TOKEN (incl. local .dev.vars)
// to call /api/cron/run and /api/holds/expire.
import { timingSafeEqual } from "node:crypto";
import { json } from "@sveltejs/kit";

function unauthorized(): Response {
  return json({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing cron token." } }, { status: 401 });
}

/** Returns a 401 Response when the request is not authorized, else null. */
export function requireCronAuth(request: Request, token: string | undefined): Response | null {
  if (!token) return unauthorized(); // fail closed when not configured
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${token}`;
  const a = new TextEncoder().encode(header);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return unauthorized();
  return null;
}

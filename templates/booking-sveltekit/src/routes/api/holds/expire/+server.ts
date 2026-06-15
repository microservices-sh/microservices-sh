import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { expireHolds } from "$lib/server/lifecycle";

// Delete expired slot holds. Intended for a Cloudflare Cron Trigger / scheduler.
// Gated by CRON_TOKEN when set (bearer); open when unset for local dev. The full
// scheduled() worker handler is wired alongside reminders in P3.
export const POST: RequestHandler = async ({ request, platform }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return json({ ok: false, error: { code: "NO_DB", message: "Database not bound." } }, { status: 503 });
  }
  const token = platform?.env?.CRON_TOKEN;
  if (token && request.headers.get("authorization") !== `Bearer ${token}`) {
    return json({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid cron token." } }, { status: 401 });
  }
  const removed = await expireHolds(db);
  return json({ ok: true, data: { removed } });
};

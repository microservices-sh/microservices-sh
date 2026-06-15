import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { expireHolds } from "$lib/server/lifecycle";
import { requireCronAuth } from "$lib/server/cron-auth";

// Delete expired slot holds. Requires CRON_TOKEN (fail-closed). Intended for a
// Cloudflare Cron Trigger / scheduler — see docs/cron.md.
export const POST: RequestHandler = async ({ request, platform }) => {
  const denied = requireCronAuth(request, platform?.env?.CRON_TOKEN);
  if (denied) return denied;

  const db = platform?.env?.DB;
  if (!db) {
    return json({ ok: false, error: { code: "NO_DB", message: "Database not bound." } }, { status: 503 });
  }
  const removed = await expireHolds(db);
  return json({ ok: true, data: { removed } });
};

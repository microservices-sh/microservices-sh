import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { runAccountingScheduled } from "$lib/server/scheduled";

export const POST: RequestHandler = async ({ request, platform }) => {
  const token = platform?.env?.CRON_TOKEN;
  const authorization = request.headers.get("authorization") ?? "";
  if (!token || authorization !== `Bearer ${token}`) {
    return json({ ok: false, error: { code: "UNAUTHORIZED", message: "Cron token is invalid." } }, { status: 401 });
  }

  const result = await runAccountingScheduled({ cron: "*/5 * * * *", scheduledTime: Date.now() }, platform?.env);
  if (!result.scheduled.ok) {
    return json({ ok: false, error: result.scheduled.error }, { status: result.scheduled.status ?? 400 });
  }
  if (!result.ran.ok) {
    return json({ ok: false, error: result.ran.error }, { status: result.ran.status ?? 400 });
  }

  return json({
    ok: true,
    enqueued: result.scheduled.data.enqueued,
    ran: result.ran.data.ran
  });
};

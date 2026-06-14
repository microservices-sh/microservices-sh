import { runJob } from "./run-job";
import type { JobRunStore, JobStore } from "../ports";
import type { JobHandler } from "../types";

// Worker entry point: pull every due job and run it via its registered handler.
// Drive this from a Cron Trigger or queue consumer. A job whose type has no
// registered handler is left pending (not failed) so a deploy gap never burns
// the retry budget.
export async function runDueJobs(
  handlers: Record<string, JobHandler>,
  deps: { jobStore: JobStore; runStore: JobRunStore; now?: () => number; batchSize?: number }
) {
  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const due = await deps.jobStore.listDue(nowIso, deps.batchSize ?? 25);

  const results: Array<{ id: string; status: string }> = [];
  for (const job of due) {
    const handler = handlers[job.type];
    if (!handler) {
      results.push({ id: job.id, status: "no_handler" });
      continue;
    }
    const res = await runJob(job.id, handler, { jobStore: deps.jobStore, runStore: deps.runStore, now: deps.now });
    results.push({ id: job.id, status: res.data?.status ?? (res.ok ? "ok" : "error") });
  }

  return { ok: true as const, status: 200 as const, data: { ran: results.length, results } };
}

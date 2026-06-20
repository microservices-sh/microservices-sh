import { ok } from "@microservices-sh/connection-contract";
import { jobsWorkflowsMeta } from "../meta";
import type { ScheduleStore } from "../ports";

// Read-only schedule inventory for operator consoles and audits.
export async function listSchedules(
  deps: { scheduleStore: ScheduleStore; correlationId?: string }
) {
  const meta = jobsWorkflowsMeta(deps);
  const schedules = await deps.scheduleStore.list();
  return ok(200, { schedules, count: schedules.length }, meta);
}

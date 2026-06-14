import { upsertScheduleInputSchema } from "../schemas";
import type { ScheduleStore } from "../ports";
import type { JobSchedule } from "../types";

// Create or update a recurring schedule. On update the existing cadence
// (nextRunAt/lastRunAt) is preserved so editing the payload does not reset timing.
export async function upsertSchedule(
  input: unknown,
  deps: { scheduleStore: ScheduleStore; now?: () => number }
) {
  const parsed = upsertScheduleInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_SCHEDULE_INPUT", message: "Schedule input is invalid.", issues: parsed.error.issues }
    };
  }

  const nowMs = deps.now?.() ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const id = parsed.data.id ?? "sch_" + crypto.randomUUID().slice(0, 16);
  const existing = await deps.scheduleStore.get(id);
  const firstRun = parsed.data.firstRunAt ?? new Date(nowMs + parsed.data.intervalMs).toISOString();

  const schedule: JobSchedule = {
    id,
    type: parsed.data.type,
    payload: parsed.data.payload,
    intervalMs: parsed.data.intervalMs,
    maxAttempts: parsed.data.maxAttempts,
    lastRunAt: existing?.lastRunAt ?? null,
    nextRunAt: existing?.nextRunAt ?? firstRun,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso
  };
  await deps.scheduleStore.upsert(schedule);

  return {
    ok: true as const,
    status: existing ? (200 as const) : (201 as const),
    data: { id: schedule.id, nextRunAt: schedule.nextRunAt }
  };
}

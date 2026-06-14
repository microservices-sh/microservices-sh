import type { ScheduleStore } from "../ports";
import type { JobSchedule } from "../types";

export function createMemoryScheduleStore(): ScheduleStore {
  const schedules = new Map<string, JobSchedule>();

  return {
    async upsert(schedule) {
      schedules.set(schedule.id, { ...schedule });
    },

    async get(id) {
      const schedule = schedules.get(id);
      return schedule ? { ...schedule } : null;
    },

    async listDue(nowIso) {
      return [...schedules.values()]
        .filter((schedule) => schedule.nextRunAt <= nowIso)
        .sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))
        .map((schedule) => ({ ...schedule }));
    },

    async list() {
      return [...schedules.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((schedule) => ({ ...schedule }));
    }
  };
}

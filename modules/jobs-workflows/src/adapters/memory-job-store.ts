import type { JobStore } from "../ports";
import type { Job } from "../types";

// In-memory store for local dev and tests. Never make real I/O in tests.
export function createMemoryJobStore(): JobStore {
  const jobs = new Map<string, Job>();

  return {
    async insert(job) {
      if (job.idempotencyKey) {
        for (const existing of jobs.values()) {
          if (existing.idempotencyKey === job.idempotencyKey) {
            // Emulate the D1 unique-constraint violation so enqueueJob's race
            // handling is exercised in tests too.
            throw new Error("UNIQUE constraint failed: jobs.idempotency_key");
          }
        }
      }
      jobs.set(job.id, { ...job });
    },

    async get(id) {
      const job = jobs.get(id);
      return job ? { ...job } : null;
    },

    async findByIdempotencyKey(key) {
      for (const job of jobs.values()) {
        if (job.idempotencyKey === key) return { ...job };
      }
      return null;
    },

    async update(job) {
      if (!jobs.has(job.id)) return;
      jobs.set(job.id, { ...job });
    },

    async listDue(nowIso, limit) {
      return [...jobs.values()]
        .filter((job) => job.status === "pending" && job.runAt <= nowIso)
        .sort((a, b) => a.runAt.localeCompare(b.runAt))
        .slice(0, limit)
        .map((job) => ({ ...job }));
    },

    async list(filter) {
      let rows = [...jobs.values()];
      if (filter.status) rows = rows.filter((job) => job.status === filter.status);
      if (filter.type) rows = rows.filter((job) => job.type === filter.type);
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return rows.slice(0, filter.limit ?? 100).map((job) => ({ ...job }));
    }
  };
}

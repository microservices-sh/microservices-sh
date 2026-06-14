import { listJobsFilterSchema } from "../schemas";
import type { JobStore } from "../ports";

// Observability: list jobs by status/type, including the dead-letter view
// (status: "dead"). Read-only.
export async function listJobs(input: unknown, deps: { jobStore: JobStore }) {
  const parsed = listJobsFilterSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_FILTER", message: "List filter is invalid.", issues: parsed.error.issues }
    };
  }
  const jobs = await deps.jobStore.list(parsed.data);
  return { ok: true as const, status: 200 as const, data: { jobs, count: jobs.length } };
}

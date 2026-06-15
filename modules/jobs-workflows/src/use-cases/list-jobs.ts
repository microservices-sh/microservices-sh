import { ok, err } from "@microservices-sh/connection-contract";
import { listJobsFilterSchema } from "../schemas";
import { jobsWorkflowsMeta } from "../meta";
import type { JobStore } from "../ports";

// Observability: list jobs by status/type, including the dead-letter view
// (status: "dead"). Read-only.
export async function listJobs(
  input: unknown,
  deps: { jobStore: JobStore; correlationId?: string }
) {
  const meta = jobsWorkflowsMeta(deps);

  const parsed = listJobsFilterSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return err(
      400,
      { code: "jobs-workflows.INVALID_FILTER", message: "List filter is invalid.", issues: parsed.error.issues },
      meta
    );
  }
  const jobs = await deps.jobStore.list(parsed.data);
  return ok(200, { jobs, count: jobs.length }, meta);
}

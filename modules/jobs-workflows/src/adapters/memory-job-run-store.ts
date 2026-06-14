import type { JobRunStore } from "../ports";
import type { JobRun } from "../types";

export function createMemoryJobRunStore(): JobRunStore {
  const runs: JobRun[] = [];

  return {
    async append(run) {
      runs.push({ ...run });
    },

    async listForJob(jobId) {
      return runs
        .filter((run) => run.jobId === jobId)
        .sort((a, b) => a.attempt - b.attempt)
        .map((run) => ({ ...run }));
    }
  };
}

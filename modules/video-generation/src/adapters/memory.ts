import type { VideoGenerationStore } from "../ports";
import type {
  ListVideoJobsInput,
  VideoGenerationJob,
  VideoGenerationOutput
} from "../types";

export interface VideoGenerationMemoryStoreState {
  jobs?: VideoGenerationJob[];
  outputs?: VideoGenerationOutput[];
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function providerKey(tenantId: string, providerTaskId: string): string {
  return `${tenantId}:${providerTaskId}`;
}

function matches(job: VideoGenerationJob, input: ListVideoJobsInput = {}): boolean {
  if (input.ownerId !== undefined && job.ownerId !== input.ownerId) return false;
  if (input.status && job.status !== input.status) return false;
  return true;
}

export function createVideoGenerationMemoryStore(initialState: VideoGenerationMemoryStoreState = {}): VideoGenerationStore {
  const jobs = new Map<string, VideoGenerationJob>();
  const providerTasks = new Map<string, string>();
  const outputs = new Map<string, VideoGenerationOutput>();

  for (const job of initialState.jobs ?? []) {
    jobs.set(job.id, copy(job));
    if (job.providerTaskId) providerTasks.set(providerKey(job.tenantId, job.providerTaskId), job.id);
  }
  for (const output of initialState.outputs ?? []) outputs.set(output.id, copy(output));

  return {
    async getJob(tenantId, jobId) {
      const job = jobs.get(jobId);
      return job?.tenantId === tenantId ? copy(job) : null;
    },
    async getJobByProviderTaskId(tenantId, providerTaskId) {
      const id = providerTasks.get(providerKey(tenantId, providerTaskId));
      const job = id ? jobs.get(id) : null;
      return job ? copy(job) : null;
    },
    async upsertJob(job) {
      const existing = jobs.get(job.id);
      if (existing?.providerTaskId) providerTasks.delete(providerKey(existing.tenantId, existing.providerTaskId));
      jobs.set(job.id, copy(job));
      if (job.providerTaskId) providerTasks.set(providerKey(job.tenantId, job.providerTaskId), job.id);
    },
    async listJobs(tenantId, input = {}) {
      return [...jobs.values()]
        .filter((job) => job.tenantId === tenantId && matches(job, input))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, input.limit ?? 50)
        .map(copy);
    },
    async insertOutput(output) {
      outputs.set(output.id, copy(output));
    },
    async getOutputByProviderUrl(tenantId, jobId, providerUrl) {
      const output = [...outputs.values()].find((candidate) => candidate.tenantId === tenantId && candidate.jobId === jobId && candidate.providerUrl === providerUrl);
      return output ? copy(output) : null;
    },
    async listOutputsForJob(tenantId, jobId) {
      return [...outputs.values()]
        .filter((output) => output.tenantId === tenantId && output.jobId === jobId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(copy);
    }
  };
}

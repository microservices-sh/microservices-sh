import type { DocumentExtractionJob, DocumentExtractionStore } from "../types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createMemoryDocumentExtractionStore(seed: DocumentExtractionJob[] = []): DocumentExtractionStore {
  const jobs = new Map(seed.map((job) => [job.id, clone(job)]));

  return {
    async createJob(job) {
      jobs.set(job.id, clone(job));
      return clone(job);
    },

    async getJob({ jobId, tenantId }) {
      const job = jobs.get(jobId);
      if (!job || job.tenantId !== tenantId) return null;
      return clone(job);
    },

    async listJobs({ tenantId, ownerId, status, limit = 100 }) {
      return [...jobs.values()]
        .filter((job) => job.tenantId === tenantId)
        .filter((job) => ownerId === undefined || job.ownerId === ownerId)
        .filter((job) => !status || job.status === status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(clone);
    },

    async updateJob({ jobId, tenantId, patch }) {
      const current = jobs.get(jobId);
      if (!current || current.tenantId !== tenantId) return null;
      const next = { ...current, ...clone(patch), id: current.id, tenantId: current.tenantId };
      jobs.set(jobId, next);
      return clone(next);
    }
  };
}

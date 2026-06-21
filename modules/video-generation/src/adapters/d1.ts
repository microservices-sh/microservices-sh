import type { VideoGenerationStore } from "../ports";
import type {
  ListVideoJobsInput,
  VideoAspectRatio,
  VideoGenerationJob,
  VideoGenerationOutput,
  VideoJobStatus,
  VideoReferenceAsset,
  VideoResolution
} from "../types";

const JOB_COLS =
  "id, tenant_id, owner_id, provider, provider_task_id, model, prompt, negative_prompt, status, duration_seconds, resolution, aspect_ratio, seed, reference_assets_json, progress, error_message, metadata_json, created_by, created_at, updated_at, submitted_at, completed_at, failed_at, cancelled_at";
const OUTPUT_COLS = "id, tenant_id, job_id, storage_key, public_url, provider_url, mime_type, size_bytes, width, height, duration_seconds, expires_at, created_at";

function nullable(value: unknown): string | null {
  return value == null ? null : String(value);
}

function nullableNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function parseObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseReferences(value: unknown): VideoReferenceAsset[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toJob(row: Record<string, unknown>): VideoGenerationJob {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    ownerId: nullable(row.owner_id),
    provider: String(row.provider),
    providerTaskId: nullable(row.provider_task_id),
    model: nullable(row.model),
    prompt: String(row.prompt),
    negativePrompt: nullable(row.negative_prompt),
    status: String(row.status) as VideoJobStatus,
    durationSeconds: Number(row.duration_seconds ?? 0),
    resolution: String(row.resolution) as VideoResolution,
    aspectRatio: String(row.aspect_ratio) as VideoAspectRatio,
    seed: nullableNumber(row.seed),
    referenceAssets: parseReferences(row.reference_assets_json),
    progress: nullableNumber(row.progress),
    errorMessage: nullable(row.error_message),
    metadata: parseObject(row.metadata_json),
    createdBy: nullable(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    submittedAt: nullable(row.submitted_at),
    completedAt: nullable(row.completed_at),
    failedAt: nullable(row.failed_at),
    cancelledAt: nullable(row.cancelled_at)
  };
}

function toOutput(row: Record<string, unknown>): VideoGenerationOutput {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    jobId: String(row.job_id),
    storageKey: nullable(row.storage_key),
    publicUrl: nullable(row.public_url),
    providerUrl: nullable(row.provider_url),
    mimeType: String(row.mime_type),
    sizeBytes: nullableNumber(row.size_bytes),
    width: nullableNumber(row.width),
    height: nullableNumber(row.height),
    durationSeconds: nullableNumber(row.duration_seconds),
    expiresAt: nullable(row.expires_at),
    createdAt: String(row.created_at)
  };
}

export function createD1VideoGenerationStore(db: D1Database): VideoGenerationStore {
  return {
    async getJob(tenantId, jobId) {
      const row = await db.prepare(`SELECT ${JOB_COLS} FROM video_generation_jobs WHERE tenant_id = ? AND id = ?`).bind(tenantId, jobId).first<Record<string, unknown>>();
      return row ? toJob(row) : null;
    },
    async getJobByProviderTaskId(tenantId, providerTaskId) {
      const row = await db.prepare(`SELECT ${JOB_COLS} FROM video_generation_jobs WHERE tenant_id = ? AND provider_task_id = ?`).bind(tenantId, providerTaskId).first<Record<string, unknown>>();
      return row ? toJob(row) : null;
    },
    async upsertJob(job) {
      await db
        .prepare(
          `INSERT INTO video_generation_jobs (${JOB_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, id) DO UPDATE SET owner_id = excluded.owner_id, provider = excluded.provider, provider_task_id = excluded.provider_task_id, model = excluded.model, prompt = excluded.prompt, negative_prompt = excluded.negative_prompt, status = excluded.status, duration_seconds = excluded.duration_seconds, resolution = excluded.resolution, aspect_ratio = excluded.aspect_ratio, seed = excluded.seed, reference_assets_json = excluded.reference_assets_json, progress = excluded.progress, error_message = excluded.error_message, metadata_json = excluded.metadata_json, updated_at = excluded.updated_at, submitted_at = excluded.submitted_at, completed_at = excluded.completed_at, failed_at = excluded.failed_at, cancelled_at = excluded.cancelled_at`
        )
        .bind(
          job.id,
          job.tenantId,
          job.ownerId,
          job.provider,
          job.providerTaskId,
          job.model,
          job.prompt,
          job.negativePrompt,
          job.status,
          job.durationSeconds,
          job.resolution,
          job.aspectRatio,
          job.seed,
          JSON.stringify(job.referenceAssets),
          job.progress,
          job.errorMessage,
          JSON.stringify(job.metadata),
          job.createdBy,
          job.createdAt,
          job.updatedAt,
          job.submittedAt,
          job.completedAt,
          job.failedAt,
          job.cancelledAt
        )
        .run();
    },
    async listJobs(tenantId, input: ListVideoJobsInput = {}) {
      const clauses = ["tenant_id = ?"];
      const params: unknown[] = [tenantId];
      if (input.ownerId !== undefined) {
        clauses.push("owner_id IS ?");
        params.push(input.ownerId);
      }
      if (input.status) {
        clauses.push("status = ?");
        params.push(input.status);
      }
      params.push(input.limit ?? 50);
      const result = await db
        .prepare(`SELECT ${JOB_COLS} FROM video_generation_jobs WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`)
        .bind(...params)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(toJob);
    },
    async insertOutput(output) {
      await db
        .prepare(`INSERT INTO video_generation_outputs (${OUTPUT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          output.id,
          output.tenantId,
          output.jobId,
          output.storageKey,
          output.publicUrl,
          output.providerUrl,
          output.mimeType,
          output.sizeBytes,
          output.width,
          output.height,
          output.durationSeconds,
          output.expiresAt,
          output.createdAt
        )
        .run();
    },
    async getOutputByProviderUrl(tenantId, jobId, providerUrl) {
      const row = await db.prepare(`SELECT ${OUTPUT_COLS} FROM video_generation_outputs WHERE tenant_id = ? AND job_id = ? AND provider_url = ?`).bind(tenantId, jobId, providerUrl).first<Record<string, unknown>>();
      return row ? toOutput(row) : null;
    },
    async listOutputsForJob(tenantId, jobId) {
      const result = await db.prepare(`SELECT ${OUTPUT_COLS} FROM video_generation_outputs WHERE tenant_id = ? AND job_id = ? ORDER BY created_at ASC`).bind(tenantId, jobId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toOutput);
    }
  };
}

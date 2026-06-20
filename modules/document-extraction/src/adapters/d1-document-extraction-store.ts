import type {
  DocumentExtractionJob,
  DocumentExtractionStore,
  DocumentReference,
  ExtractionDraft,
  ExtractionJobStatus,
  ExtractionMode,
  ExtractionReview,
  ExtractionRuntime,
  ExtractionTargetType
} from "../types";

const COLS = [
  "id",
  "tenant_id",
  "owner_id",
  "status",
  "target_type",
  "schema_id",
  "requested_mode",
  "selected_runtime",
  "source_file_id",
  "source_key",
  "source_mime_type",
  "source_original_name",
  "source_page_count",
  "source_bytes",
  "source_sha256",
  "draft_json",
  "approved_output_json",
  "review_json",
  "metadata_json",
  "error_message",
  "created_at",
  "updated_at"
].join(", ");

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  return JSON.parse(value) as T;
}

function stringifyJson(value: unknown): string | null {
  return value == null ? null : JSON.stringify(value);
}

function rowToJob(row: Record<string, unknown>): DocumentExtractionJob {
  const source: DocumentReference = {
    fileId: row.source_file_id == null ? undefined : String(row.source_file_id),
    key: row.source_key == null ? undefined : String(row.source_key),
    mimeType: String(row.source_mime_type),
    originalName: row.source_original_name == null ? undefined : String(row.source_original_name),
    pageCount: row.source_page_count == null ? undefined : Number(row.source_page_count),
    bytes: row.source_bytes == null ? undefined : Number(row.source_bytes),
    sha256: row.source_sha256 == null ? undefined : String(row.source_sha256)
  };

  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    ownerId: row.owner_id == null ? null : String(row.owner_id),
    status: String(row.status) as ExtractionJobStatus,
    targetType: String(row.target_type) as ExtractionTargetType,
    schemaId: String(row.schema_id),
    requestedMode: String(row.requested_mode) as ExtractionMode,
    selectedRuntime: row.selected_runtime == null ? null : (String(row.selected_runtime) as ExtractionRuntime),
    source,
    draft: parseJson<ExtractionDraft | null>(row.draft_json, null),
    approvedOutput: parseJson<Record<string, unknown> | null>(row.approved_output_json, null),
    review: parseJson<ExtractionReview | null>(row.review_json, null),
    metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
    error: row.error_message == null ? null : String(row.error_message),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function jobValues(job: DocumentExtractionJob): unknown[] {
  return [
    job.id,
    job.tenantId,
    job.ownerId,
    job.status,
    job.targetType,
    job.schemaId,
    job.requestedMode,
    job.selectedRuntime,
    job.source.fileId ?? null,
    job.source.key ?? null,
    job.source.mimeType,
    job.source.originalName ?? null,
    job.source.pageCount ?? null,
    job.source.bytes ?? null,
    job.source.sha256 ?? null,
    stringifyJson(job.draft),
    stringifyJson(job.approvedOutput),
    stringifyJson(job.review),
    JSON.stringify(job.metadata ?? {}),
    job.error,
    job.createdAt,
    job.updatedAt
  ];
}

export function createD1DocumentExtractionStore(db: D1Database): DocumentExtractionStore {
  return {
    async createJob(job) {
      await db
        .prepare(`INSERT INTO document_extraction_jobs (${COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(...jobValues(job))
        .run();
      return job;
    },

    async getJob({ jobId, tenantId }) {
      const row = await db
        .prepare(`SELECT ${COLS} FROM document_extraction_jobs WHERE id = ? AND tenant_id = ?`)
        .bind(jobId, tenantId)
        .first<Record<string, unknown>>();
      return row ? rowToJob(row) : null;
    },

    async listJobs({ tenantId, ownerId, status, limit = 100 }) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [tenantId];

      if (ownerId !== undefined) {
        if (ownerId === null) {
          clauses.push("owner_id IS NULL");
        } else {
          clauses.push("owner_id = ?");
          binds.push(ownerId);
        }
      }

      if (status) {
        clauses.push("status = ?");
        binds.push(status);
      }

      const result = await db
        .prepare(`SELECT ${COLS} FROM document_extraction_jobs WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`)
        .bind(...binds, limit)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToJob);
    },

    async updateJob({ jobId, tenantId, patch }) {
      const current = await this.getJob({ jobId, tenantId });
      if (!current) return null;
      const next = { ...current, ...patch, id: current.id, tenantId: current.tenantId };

      await db
        .prepare(
          `UPDATE document_extraction_jobs SET
             owner_id = ?, status = ?, target_type = ?, schema_id = ?, requested_mode = ?, selected_runtime = ?,
             source_file_id = ?, source_key = ?, source_mime_type = ?, source_original_name = ?, source_page_count = ?,
             source_bytes = ?, source_sha256 = ?, draft_json = ?, approved_output_json = ?, review_json = ?,
             metadata_json = ?, error_message = ?, created_at = ?, updated_at = ?
           WHERE id = ? AND tenant_id = ?`
        )
        .bind(
          next.ownerId,
          next.status,
          next.targetType,
          next.schemaId,
          next.requestedMode,
          next.selectedRuntime,
          next.source.fileId ?? null,
          next.source.key ?? null,
          next.source.mimeType,
          next.source.originalName ?? null,
          next.source.pageCount ?? null,
          next.source.bytes ?? null,
          next.source.sha256 ?? null,
          stringifyJson(next.draft),
          stringifyJson(next.approvedOutput),
          stringifyJson(next.review),
          JSON.stringify(next.metadata ?? {}),
          next.error,
          next.createdAt,
          next.updatedAt,
          next.id,
          next.tenantId
        )
        .run();

      return next;
    }
  };
}

import type { ProjectProgressStore } from "../ports";
import type {
  ListProjectsInput,
  ProgressCategory,
  ProgressLog,
  ProgressMediaFile,
  ProgressMediaType,
  ProjectAccessGrant,
  ProjectComment,
  ProjectCommentAuthorType,
  ProjectProgressProject,
  ProjectStatus
} from "../types";

const PROJECT_COLS =
  "id, tenant_id, customer_id, title, description, location, status, access_token, qr_code_key, start_date, expected_end_date, actual_end_date, created_by_id, created_at, updated_at";
const ACCESS_COLS = "id, tenant_id, project_id, user_id, can_upload, can_view, created_by_id, created_at";
const LOG_COLS = "id, tenant_id, project_id, uploader_id, category, description, voice_note_key, captured_at, created_at";
const MEDIA_COLS = "id, tenant_id, log_id, storage_key, thumbnail_key, file_type, mime_type, file_size_bytes, duration_seconds, width, height, created_at";
const COMMENT_COLS = "id, tenant_id, project_id, log_id, author_type, author_name, author_id, content, created_at";

function bool(value: unknown): boolean {
  return Number(value ?? 0) === 1;
}

function nullable(value: unknown): string | null {
  return value == null ? null : String(value);
}

function nullableNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function toProject(row: Record<string, unknown>): ProjectProgressProject {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    customerId: String(row.customer_id),
    title: String(row.title),
    description: nullable(row.description),
    location: nullable(row.location),
    status: String(row.status) as ProjectStatus,
    accessToken: String(row.access_token),
    qrCodeKey: nullable(row.qr_code_key),
    startDate: nullable(row.start_date),
    expectedEndDate: nullable(row.expected_end_date),
    actualEndDate: nullable(row.actual_end_date),
    createdById: nullable(row.created_by_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toAccess(row: Record<string, unknown>): ProjectAccessGrant {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    projectId: String(row.project_id),
    userId: String(row.user_id),
    canUpload: bool(row.can_upload),
    canView: bool(row.can_view),
    createdById: nullable(row.created_by_id),
    createdAt: String(row.created_at)
  };
}

function toLog(row: Record<string, unknown>): ProgressLog {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    projectId: String(row.project_id),
    uploaderId: String(row.uploader_id),
    category: String(row.category) as ProgressCategory,
    description: nullable(row.description),
    voiceNoteKey: nullable(row.voice_note_key),
    capturedAt: String(row.captured_at),
    createdAt: String(row.created_at)
  };
}

function toMedia(row: Record<string, unknown>): ProgressMediaFile {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    logId: String(row.log_id),
    storageKey: String(row.storage_key),
    thumbnailKey: nullable(row.thumbnail_key),
    fileType: String(row.file_type) as ProgressMediaType,
    mimeType: String(row.mime_type),
    fileSizeBytes: Number(row.file_size_bytes ?? 0),
    durationSeconds: nullableNumber(row.duration_seconds),
    width: nullableNumber(row.width),
    height: nullableNumber(row.height),
    createdAt: String(row.created_at)
  };
}

function toComment(row: Record<string, unknown>): ProjectComment {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    projectId: String(row.project_id),
    logId: nullable(row.log_id),
    authorType: String(row.author_type) as ProjectCommentAuthorType,
    authorName: String(row.author_name),
    authorId: nullable(row.author_id),
    content: String(row.content),
    createdAt: String(row.created_at)
  };
}

export function createD1ProjectProgressStore(db: D1Database): ProjectProgressStore {
  return {
    async getProject(tenantId, projectId) {
      const row = await db.prepare(`SELECT ${PROJECT_COLS} FROM project_progress_projects WHERE tenant_id = ? AND id = ?`).bind(tenantId, projectId).first<Record<string, unknown>>();
      return row ? toProject(row) : null;
    },
    async getProjectByAccessToken(tenantId, accessToken) {
      const row = await db.prepare(`SELECT ${PROJECT_COLS} FROM project_progress_projects WHERE tenant_id = ? AND access_token = ?`).bind(tenantId, accessToken).first<Record<string, unknown>>();
      return row ? toProject(row) : null;
    },
    async upsertProject(project) {
      await db
        .prepare(
          `INSERT INTO project_progress_projects (${PROJECT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, id) DO UPDATE SET customer_id = excluded.customer_id, title = excluded.title, description = excluded.description, location = excluded.location, status = excluded.status, access_token = excluded.access_token, qr_code_key = excluded.qr_code_key, start_date = excluded.start_date, expected_end_date = excluded.expected_end_date, actual_end_date = excluded.actual_end_date, updated_at = excluded.updated_at`
        )
        .bind(
          project.id,
          project.tenantId,
          project.customerId,
          project.title,
          project.description,
          project.location,
          project.status,
          project.accessToken,
          project.qrCodeKey,
          project.startDate,
          project.expectedEndDate,
          project.actualEndDate,
          project.createdById,
          project.createdAt,
          project.updatedAt
        )
        .run();
    },
    async listProjects(tenantId, input: ListProjectsInput = {}) {
      const clauses = ["tenant_id = ?"];
      const params: unknown[] = [tenantId];
      if (input.customerId) {
        clauses.push("customer_id = ?");
        params.push(input.customerId);
      }
      if (input.status) {
        clauses.push("status = ?");
        params.push(input.status);
      }
      if (input.userId) {
        clauses.push("id IN (SELECT project_id FROM project_progress_access WHERE tenant_id = ? AND user_id = ? AND can_view = 1)");
        params.push(tenantId, input.userId);
      }
      params.push(input.limit ?? 50);
      const result = await db.prepare(`SELECT ${PROJECT_COLS} FROM project_progress_projects WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`).bind(...params).all<Record<string, unknown>>();
      return (result.results ?? []).map(toProject);
    },

    async getProjectAccess(tenantId, projectId, userId) {
      const row = await db.prepare(`SELECT ${ACCESS_COLS} FROM project_progress_access WHERE tenant_id = ? AND project_id = ? AND user_id = ?`).bind(tenantId, projectId, userId).first<Record<string, unknown>>();
      return row ? toAccess(row) : null;
    },
    async upsertProjectAccess(access) {
      await db
        .prepare(
          `INSERT INTO project_progress_access (${ACCESS_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, project_id, user_id) DO UPDATE SET can_upload = excluded.can_upload, can_view = excluded.can_view`
        )
        .bind(access.id, access.tenantId, access.projectId, access.userId, access.canUpload ? 1 : 0, access.canView ? 1 : 0, access.createdById, access.createdAt)
        .run();
    },
    async deleteProjectAccess(tenantId, projectId, userId) {
      await db.prepare("DELETE FROM project_progress_access WHERE tenant_id = ? AND project_id = ? AND user_id = ?").bind(tenantId, projectId, userId).run();
    },
    async listProjectAccess(tenantId, projectId) {
      const result = await db.prepare(`SELECT ${ACCESS_COLS} FROM project_progress_access WHERE tenant_id = ? AND project_id = ? ORDER BY user_id ASC`).bind(tenantId, projectId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toAccess);
    },

    async insertProgressLog(log) {
      await db.prepare(`INSERT INTO project_progress_logs (${LOG_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(log.id, log.tenantId, log.projectId, log.uploaderId, log.category, log.description, log.voiceNoteKey, log.capturedAt, log.createdAt).run();
    },
    async getProgressLog(tenantId, logId) {
      const row = await db.prepare(`SELECT ${LOG_COLS} FROM project_progress_logs WHERE tenant_id = ? AND id = ?`).bind(tenantId, logId).first<Record<string, unknown>>();
      return row ? toLog(row) : null;
    },
    async listProgressLogsByProject(tenantId, projectId) {
      const result = await db.prepare(`SELECT ${LOG_COLS} FROM project_progress_logs WHERE tenant_id = ? AND project_id = ? ORDER BY captured_at DESC`).bind(tenantId, projectId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toLog);
    },

    async insertMediaFile(file) {
      await db
        .prepare(`INSERT INTO project_progress_media_files (${MEDIA_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(file.id, file.tenantId, file.logId, file.storageKey, file.thumbnailKey, file.fileType, file.mimeType, file.fileSizeBytes, file.durationSeconds, file.width, file.height, file.createdAt)
        .run();
    },
    async listMediaFilesByLog(tenantId, logId) {
      const result = await db.prepare(`SELECT ${MEDIA_COLS} FROM project_progress_media_files WHERE tenant_id = ? AND log_id = ? ORDER BY created_at DESC`).bind(tenantId, logId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toMedia);
    },

    async insertComment(comment) {
      await db.prepare(`INSERT INTO project_progress_comments (${COMMENT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(comment.id, comment.tenantId, comment.projectId, comment.logId, comment.authorType, comment.authorName, comment.authorId, comment.content, comment.createdAt).run();
    },
    async listCommentsByProject(tenantId, projectId) {
      const result = await db.prepare(`SELECT ${COMMENT_COLS} FROM project_progress_comments WHERE tenant_id = ? AND project_id = ? ORDER BY created_at DESC`).bind(tenantId, projectId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toComment);
    },
    async listCommentsByLog(tenantId, logId) {
      const result = await db.prepare(`SELECT ${COMMENT_COLS} FROM project_progress_comments WHERE tenant_id = ? AND log_id = ? ORDER BY created_at DESC`).bind(tenantId, logId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toComment);
    }
  };
}

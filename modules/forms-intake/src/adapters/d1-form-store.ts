import type { FormStore } from "../ports";
import type { AttachmentRef, Form, FormField, FormStatus, FormSubmission } from "../types";

// The serializable field set (and submission values/attachments) are stored as
// JSON TEXT columns. Round-tripping through JSON.stringify/parse is exactly why
// the field definitions must stay plain data — see types.ts.
function rowToForm(row: Record<string, unknown>): Form {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    status: String(row.status) as FormStatus,
    fields: JSON.parse(String(row.fields ?? "[]")) as FormField[],
    requireTurnstile: Number(row.require_turnstile ?? 0) === 1,
    version: Number(row.version ?? 1),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToSubmission(row: Record<string, unknown>): FormSubmission {
  return {
    id: String(row.id),
    formId: String(row.form_id),
    tenantId: String(row.tenant_id),
    values: JSON.parse(String(row.values ?? "{}")) as Record<string, string | number | boolean>,
    attachments: JSON.parse(String(row.attachments ?? "[]")) as AttachmentRef[],
    idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : null,
    submittedAt: String(row.submitted_at),
    status: String(row.status ?? "pending") as FormSubmission["status"],
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewNote: row.review_note ? String(row.review_note) : null
  };
}

const FORM_COLS = "id, tenant_id, name, status, fields, require_turnstile, version, created_at, updated_at";
// "values" is a SQL reserved word — must be quoted in column lists (works for
// both the SELECT projection and the INSERT column list).
const SUB_COLS =
  'id, form_id, tenant_id, "values", attachments, idempotency_key, submitted_at, status, reviewed_at, reviewed_by, review_note';

export function createD1FormStore(db: D1Database): FormStore {
  return {
    async insertForm(form) {
      await db
        .prepare(`INSERT INTO forms (${FORM_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          form.id,
          form.tenantId,
          form.name,
          form.status,
          JSON.stringify(form.fields),
          form.requireTurnstile ? 1 : 0,
          form.version,
          form.createdAt,
          form.updatedAt
        )
        .run();
    },

    async getForm(id, tenantId) {
      const row = await db
        .prepare(`SELECT ${FORM_COLS} FROM forms WHERE id = ? AND tenant_id = ?`)
        .bind(id, tenantId)
        .first<Record<string, unknown>>();
      return row ? rowToForm(row) : null;
    },

    async updateForm(form) {
      await db
        .prepare(
          `UPDATE forms SET name = ?, status = ?, fields = ?, require_turnstile = ?, version = ?, updated_at = ?
           WHERE id = ? AND tenant_id = ?`
        )
        .bind(
          form.name,
          form.status,
          JSON.stringify(form.fields),
          form.requireTurnstile ? 1 : 0,
          form.version,
          form.updatedAt,
          form.id,
          form.tenantId
        )
        .run();
    },

    async listForms(filter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [filter.tenantId];
      if (filter.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      const result = await db
        .prepare(`SELECT ${FORM_COLS} FROM forms WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`)
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToForm);
    },

    async insertSubmission(submission) {
      await db
        .prepare(`INSERT INTO form_submissions (${SUB_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          submission.id,
          submission.formId,
          submission.tenantId,
          JSON.stringify(submission.values),
          JSON.stringify(submission.attachments),
          submission.idempotencyKey,
          submission.submittedAt,
          submission.status,
          submission.reviewedAt,
          submission.reviewedBy,
          submission.reviewNote
        )
        .run();
    },

    async getSubmission(id, tenantId) {
      const row = await db
        .prepare(`SELECT ${SUB_COLS} FROM form_submissions WHERE id = ? AND tenant_id = ?`)
        .bind(id, tenantId)
        .first<Record<string, unknown>>();
      return row ? rowToSubmission(row) : null;
    },

    async updateSubmission(submission) {
      // Only the moderation fields are mutable; values/attachments stay immutable
      // so a reviewed submission keeps the exact data it was validated with.
      await db
        .prepare(
          `UPDATE form_submissions SET status = ?, reviewed_at = ?, reviewed_by = ?, review_note = ?
           WHERE id = ? AND tenant_id = ?`
        )
        .bind(
          submission.status,
          submission.reviewedAt,
          submission.reviewedBy,
          submission.reviewNote,
          submission.id,
          submission.tenantId
        )
        .run();
    },

    async listSubmissions(filter) {
      const clauses = ["tenant_id = ?", "form_id = ?"];
      const binds: unknown[] = [filter.tenantId, filter.formId];
      if (filter.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      const result = await db
        .prepare(
          `SELECT ${SUB_COLS} FROM form_submissions WHERE ${clauses.join(" AND ")} ORDER BY submitted_at DESC LIMIT ?`
        )
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToSubmission);
    },

    async recordSubmissionKey(formId, key) {
      try {
        await db
          .prepare("INSERT INTO submission_keys (form_id, idempotency_key) VALUES (?, ?)")
          .bind(formId, key)
          .run();
        return true;
      } catch {
        // Unique constraint on (form_id, idempotency_key): already submitted once.
        return false;
      }
    }
  };
}

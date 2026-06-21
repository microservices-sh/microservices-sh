import type { HtmlRendererStore } from "../ports";
import type { HtmlDocumentStatus, HtmlRenderAsset, HtmlRenderDocument } from "../types";

const DOCUMENT_COLS = "id, tenant_id, slug, html, assets_json, ttl_seconds, expires_at, status, created_by, created_at, updated_at, deleted_at";

function nullable(value: unknown): string | null {
  return value == null ? null : String(value);
}

function parseAssets(value: unknown): HtmlRenderAsset[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toDocument(row: Record<string, unknown>): HtmlRenderDocument {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    slug: String(row.slug),
    html: String(row.html),
    assets: parseAssets(row.assets_json),
    ttlSeconds: row.ttl_seconds == null ? null : Number(row.ttl_seconds),
    expiresAt: nullable(row.expires_at),
    status: String(row.status) as HtmlDocumentStatus,
    createdBy: nullable(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: nullable(row.deleted_at)
  };
}

export function createD1HtmlRendererStore(db: D1Database): HtmlRendererStore {
  return {
    async getDocument(tenantId, documentId) {
      const row = await db.prepare(`SELECT ${DOCUMENT_COLS} FROM html_render_documents WHERE tenant_id = ? AND id = ?`).bind(tenantId, documentId).first<Record<string, unknown>>();
      return row ? toDocument(row) : null;
    },
    async getDocumentBySlug(tenantId, slug) {
      const row = await db.prepare(`SELECT ${DOCUMENT_COLS} FROM html_render_documents WHERE tenant_id = ? AND slug = ?`).bind(tenantId, slug).first<Record<string, unknown>>();
      return row ? toDocument(row) : null;
    },
    async upsertDocument(document) {
      await db.prepare(
        `INSERT INTO html_render_documents (${DOCUMENT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, id) DO UPDATE SET html = excluded.html, assets_json = excluded.assets_json, ttl_seconds = excluded.ttl_seconds, expires_at = excluded.expires_at, status = excluded.status, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`
      )
        .bind(document.id, document.tenantId, document.slug, document.html, JSON.stringify(document.assets), document.ttlSeconds, document.expiresAt, document.status, document.createdBy, document.createdAt, document.updatedAt, document.deletedAt)
        .run();
    },
    async listDocuments(tenantId, limit = 20) {
      const result = await db.prepare(`SELECT ${DOCUMENT_COLS} FROM html_render_documents WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?`).bind(tenantId, limit).all<Record<string, unknown>>();
      return (result.results ?? []).map(toDocument);
    }
  };
}

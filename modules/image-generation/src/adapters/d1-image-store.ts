import type { ImageStore } from "../ports";
import type { AspectRatio, GeneratedImage, ImageProviderId, ImageSource, ImageStatus } from "../types";

const COLS =
  "id, tenant_id, prompt, negative_prompt, provider, aspect_ratio, key, mime_type, bytes, tokens_used, source, status, created_at, updated_at";

function rowToImage(row: Record<string, unknown>): GeneratedImage {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    prompt: String(row.prompt),
    negativePrompt: row.negative_prompt == null ? null : String(row.negative_prompt),
    provider: String(row.provider) as ImageProviderId,
    aspectRatio: String(row.aspect_ratio) as AspectRatio,
    key: String(row.key),
    mimeType: String(row.mime_type),
    bytes: Number(row.bytes ?? 0),
    tokensUsed: Number(row.tokens_used ?? 0),
    source: String(row.source) as ImageSource,
    status: String(row.status) as ImageStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function createD1ImageStore(db: D1Database): ImageStore {
  return {
    async insert(image) {
      await db
        .prepare(`INSERT INTO image_generations (${COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          image.id,
          image.tenantId,
          image.prompt,
          image.negativePrompt,
          image.provider,
          image.aspectRatio,
          image.key,
          image.mimeType,
          image.bytes,
          image.tokensUsed,
          image.source,
          image.status,
          image.createdAt,
          image.updatedAt,
        )
        .run();
    },

    async get(id) {
      const row = await db.prepare(`SELECT ${COLS} FROM image_generations WHERE id = ?`).bind(id).first<Record<string, unknown>>();
      return row ? rowToImage(row) : null;
    },

    async update(image) {
      await db
        .prepare("UPDATE image_generations SET status = ?, updated_at = ? WHERE id = ?")
        .bind(image.status, image.updatedAt, image.id)
        .run();
    },

    async list(filter) {
      const result = await db
        .prepare(
          `SELECT ${COLS} FROM image_generations WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?`,
        )
        .bind(filter.tenantId, filter.status ?? "active", filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToImage);
    },
  };
}

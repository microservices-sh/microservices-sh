import type { VectorRecord, VectorSearchMatch, VectorStore } from "./embedding-knowledge-search-index";

export type VectorizeMetadataValue = string | number | boolean | null;

export interface VectorizeBinding {
  upsert(vectors: Array<{ id: string; values: number[]; metadata?: Record<string, VectorizeMetadataValue> }>): Promise<unknown>;
  deleteByIds(ids: string[]): Promise<unknown>;
  query(
    vector: number[],
    options: {
      topK: number;
      returnMetadata?: "none" | "indexed" | "all";
      returnValues?: boolean;
      filter?: Record<string, unknown>;
    }
  ): Promise<{ matches?: Array<{ id: string; score?: number; metadata?: Record<string, unknown> }> }>;
}

const VECTORIZE_BATCH_SIZE = 1000;

function chunks<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, VectorizeMetadataValue> | undefined {
  if (!metadata) return undefined;
  const clean: Record<string, VectorizeMetadataValue> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!key || key.includes("$") || key.includes(".")) continue;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      clean[key] = value;
    }
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

function toVectorizeRecord(record: VectorRecord) {
  if (!record.id || record.id.length > 64) {
    throw new Error("Vectorize vector id must be non-empty and no longer than 64 bytes.");
  }
  if (record.values.length === 0 || !record.values.every((value) => Number.isFinite(value))) {
    throw new Error(`Vectorize vector ${record.id} has empty or invalid values.`);
  }
  return {
    id: record.id,
    values: record.values,
    metadata: sanitizeMetadata(record.metadata)
  };
}

export function createVectorizeStore(index: VectorizeBinding): VectorStore {
  return {
    async upsert(records) {
      if (records.length === 0) return;
      for (const batch of chunks(records.map(toVectorizeRecord), VECTORIZE_BATCH_SIZE)) {
        await index.upsert(batch);
      }
    },
    async deleteByIds(ids) {
      const safeIds = [...new Set(ids.filter(Boolean))];
      if (safeIds.length === 0) return;
      for (const batch of chunks(safeIds, VECTORIZE_BATCH_SIZE)) {
        await index.deleteByIds(batch);
      }
    },
    async query(vector, options) {
      if (vector.length === 0 || !vector.every((value) => Number.isFinite(value))) {
        throw new Error("Vectorize query vector has empty or invalid values.");
      }
      const result = await index.query(vector, {
        topK: Math.min(Math.max(options.topK, 1), 100),
        returnMetadata: "indexed",
        returnValues: false,
        filter: options.filter
      });
      return (result.matches ?? []).map((match): VectorSearchMatch => ({
        id: match.id,
        score: typeof match.score === "number" ? match.score : undefined,
        metadata: match.metadata
      }));
    }
  };
}

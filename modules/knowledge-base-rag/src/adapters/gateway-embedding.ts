import type { EmbeddingFn } from "./embedding-knowledge-search-index";

export type GatewayEmbedResult =
  | { ok: true; data: { vectors: number[][] } }
  | { ok: false; status: number; error: { code: string } };

export type GatewayEmbedFn = (texts: string[]) => Promise<GatewayEmbedResult>;

function assertVectors(textCount: number, vectors: number[][] | undefined) {
  if (!Array.isArray(vectors) || vectors.length !== textCount) {
    throw new Error("ai-gateway embed returned the wrong number of vectors.");
  }
  for (const vector of vectors) {
    if (!Array.isArray(vector) || vector.length === 0 || !vector.every((value) => Number.isFinite(value))) {
      throw new Error("ai-gateway embed returned an empty or invalid vector.");
    }
  }
  return vectors;
}

export function createGatewayEmbeddingFn(embed: GatewayEmbedFn): EmbeddingFn {
  return async (texts) => {
    const result = await embed(texts);
    if (!result.ok) {
      throw new Error(`ai-gateway embed failed: ${result.error.code} (${result.status})`);
    }
    return assertVectors(texts.length, result.data.vectors);
  };
}

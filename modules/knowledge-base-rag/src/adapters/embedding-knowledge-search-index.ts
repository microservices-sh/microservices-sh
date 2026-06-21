import type { KnowledgeSearchIndex, KnowledgeStore } from "../ports";
import type { KnowledgeArticle, SearchPassage } from "../types";

export type EmbeddingFn = (texts: string[]) => Promise<number[][]>;

export interface VectorRecord {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorSearchMatch {
  id: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface VectorStore {
  upsert(records: VectorRecord[]): Promise<void>;
  deleteByIds(ids: string[]): Promise<void>;
  query(vector: number[], options: { topK: number; filter?: Record<string, unknown> }): Promise<VectorSearchMatch[]>;
}

function articleEmbeddingText(article: KnowledgeArticle) {
  return [`Title: ${article.title}`, "", article.content].join("\n");
}

function projectKey(projectId: string | null) {
  return projectId ?? "__none__";
}

function filterFor(input: { tenantId: string; projectId?: string | null }) {
  const filter: Record<string, unknown> = { tenantId: input.tenantId, status: "active" };
  if (input.projectId !== undefined) filter.projectId = projectKey(input.projectId);
  return filter;
}

function excerpt(content: string, query: string) {
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean);
  const lower = content.toLowerCase();
  const first = tokens.map((token) => lower.indexOf(token)).filter((idx) => idx >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, first - 80);
  const end = Math.min(content.length, first + 260);
  return `${start > 0 ? "..." : ""}${content.slice(start, end).trim()}${end < content.length ? "..." : ""}`;
}

function assertVector(vector: number[] | undefined) {
  if (!vector || vector.length === 0 || !vector.every((value) => Number.isFinite(value))) {
    throw new Error("Embedding function returned an empty or invalid vector.");
  }
  return vector;
}

export function createEmbeddingKnowledgeSearchIndex(deps: {
  embed: EmbeddingFn;
  vectorStore: VectorStore;
  store: KnowledgeStore;
}): KnowledgeSearchIndex {
  return {
    async upsertArticle(article) {
      if (article.status !== "active") {
        await deps.vectorStore.deleteByIds([article.id]);
        return;
      }
      const vector = assertVector((await deps.embed([articleEmbeddingText(article)]))[0]);
      await deps.vectorStore.upsert([
        {
          id: article.id,
          values: vector,
          metadata: {
            tenantId: article.tenantId,
            projectId: projectKey(article.projectId),
            status: article.status,
            title: article.title,
            sourceUrl: article.sourceUrl
          }
        }
      ]);
    },
    async removeArticle(article) {
      await deps.vectorStore.deleteByIds([article.id]);
    },
    async search(input) {
      const vector = assertVector((await deps.embed([input.query]))[0]);
      const matches = await deps.vectorStore.query(vector, {
        topK: Math.max(input.limit * 4, input.limit),
        filter: filterFor(input)
      });

      const passages = await Promise.all(
        matches.map(async (match): Promise<SearchPassage | null> => {
          const article = await deps.store.getArticle(match.id);
          if (!article) return null;
          if (article.tenantId !== input.tenantId) return null;
          if (article.status !== "active") return null;
          if (input.projectId !== undefined && article.projectId !== input.projectId) return null;
          return {
            articleId: article.id,
            title: article.title,
            excerpt: excerpt(article.content, input.query),
            content: article.content,
            sourceUrl: article.sourceUrl,
            score: match.score ?? 0
          };
        })
      );

      return passages.filter((passage): passage is SearchPassage => passage !== null).slice(0, input.limit);
    }
  };
}

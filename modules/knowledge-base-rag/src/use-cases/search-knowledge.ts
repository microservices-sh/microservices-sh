import { err, ok } from "@microservices-sh/connection-contract";
import { defaultConfig } from "../config";
import { knowledgeBaseRagMeta } from "../meta";
import type { KnowledgeSearchIndex, KnowledgeStore } from "../ports";
import { searchKnowledgeInputSchema } from "../schemas";

export async function searchKnowledge(
  input: unknown,
  deps: {
    store: KnowledgeStore;
    searchIndex?: KnowledgeSearchIndex;
    config?: Partial<typeof defaultConfig>;
    correlationId?: string;
    now?: () => number;
  }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = searchKnowledgeInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_SEARCH_INPUT", message: "Knowledge search input is invalid.", issues: parsed.error.issues }, meta);
  }

  const cfg = { ...defaultConfig, ...deps.config };
  const limit = Math.min(parsed.data.limit ?? cfg.defaultSearchLimit, cfg.maxSearchLimit);
  const searchInput = { tenantId: parsed.data.tenantId, projectId: parsed.data.projectId, query: parsed.data.query, limit };
  const passages = deps.searchIndex ? await deps.searchIndex.search(searchInput) : await deps.store.searchArticles(searchInput);

  return ok(200, { passages, count: passages.length }, meta);
}

import { err, ok } from "@microservices-sh/connection-contract";
import { defaultConfig } from "../config";
import { listArticlesInputSchema } from "../schemas";
import { knowledgeBaseRagMeta } from "../meta";
import type { KnowledgeStore } from "../ports";

export async function listArticles(
  input: unknown,
  deps: { store: KnowledgeStore; config?: Partial<typeof defaultConfig>; correlationId?: string; now?: () => number }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = listArticlesInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_ARTICLE_FILTER", message: "Article list input is invalid.", issues: parsed.error.issues }, meta);
  }

  const cfg = { ...defaultConfig, ...deps.config };
  const articles = await deps.store.listArticles({
    ...parsed.data,
    limit: Math.min(parsed.data.limit ?? cfg.defaultSearchLimit, cfg.maxSearchLimit)
  });

  return ok(200, { articles, count: articles.length }, meta);
}

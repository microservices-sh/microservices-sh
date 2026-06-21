import { err, ok } from "@microservices-sh/connection-contract";
import { articleIdSchema } from "../schemas";
import { knowledgeBaseRagMeta } from "../meta";
import type { KnowledgeStore } from "../ports";

export async function getArticle(input: unknown, deps: { store: KnowledgeStore; correlationId?: string; now?: () => number }) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = articleIdSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_ARTICLE_ID", message: "Article id input is invalid.", issues: parsed.error.issues }, meta);
  }

  const article = await deps.store.getArticle(parsed.data.id);
  if (!article) {
    return err(404, { code: "knowledge-base-rag.ARTICLE_NOT_FOUND", message: "Knowledge article not found." }, meta);
  }

  return ok(200, { article }, meta);
}

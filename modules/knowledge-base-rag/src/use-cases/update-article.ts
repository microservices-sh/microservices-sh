import { err, ok } from "@microservices-sh/connection-contract";
import { updateArticleInputSchema } from "../schemas";
import { knowledgeBaseRagMeta } from "../meta";
import type { AuditSink, KnowledgeSearchIndex, KnowledgeStore } from "../ports";
import type { DomainEvent, KnowledgeArticle } from "../types";
import { countWords, errorMessage, isoFrom } from "./helpers";

export async function updateArticle(
  input: unknown,
  deps: {
    store: KnowledgeStore;
    searchIndex?: KnowledgeSearchIndex;
    audit?: AuditSink;
    actorId?: string;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = updateArticleInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_ARTICLE_UPDATE", message: "Article update input is invalid.", issues: parsed.error.issues }, meta);
  }

  const existing = await deps.store.getArticle(parsed.data.id);
  if (!existing) {
    return err(404, { code: "knowledge-base-rag.ARTICLE_NOT_FOUND", message: "Knowledge article not found." }, meta);
  }

  const nextContent = parsed.data.content?.trim() ?? existing.content;
  let article: KnowledgeArticle = {
    ...existing,
    title: parsed.data.title?.trim() ?? existing.title,
    content: nextContent,
    sourceUrl: parsed.data.sourceUrl !== undefined ? parsed.data.sourceUrl : existing.sourceUrl,
    status: parsed.data.status ?? existing.status,
    wordCount: countWords(nextContent),
    updatedAt: isoFrom(deps.now)
  };

  if (deps.searchIndex) {
    try {
      if (article.status === "active") {
        await deps.searchIndex.upsertArticle(article);
        article = { ...article, indexedAt: article.updatedAt, indexingError: null };
      } else {
        await deps.searchIndex.removeArticle(article);
        article = { ...article, indexedAt: null, indexingError: null };
      }
    } catch (error) {
      article = { ...article, indexingError: errorMessage(error) };
    }
  }

  await deps.store.updateArticle(article);
  const event: DomainEvent = {
    name: "knowledge-base-rag.article_updated",
    correlationId: meta.correlationId,
    payload: { id: article.id, tenantId: article.tenantId, status: article.status }
  };
  await deps.store.writeEvent(event);
  if (deps.audit && deps.actorId) {
    await deps.audit.record({ action: "knowledge.article_updated", actorId: deps.actorId, entityType: "knowledge_article", entityId: article.id });
  }

  return ok(200, { article, event }, meta);
}

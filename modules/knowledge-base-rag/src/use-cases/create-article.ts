import { err, ok } from "@microservices-sh/connection-contract";
import { createArticleInputSchema } from "../schemas";
import { knowledgeBaseRagMeta } from "../meta";
import type { AuditSink, KnowledgeSearchIndex, KnowledgeStore } from "../ports";
import type { DomainEvent, KnowledgeArticle } from "../types";
import { countWords, errorMessage, generatedId, isoFrom } from "./helpers";

export async function createArticle(
  input: unknown,
  deps: {
    store: KnowledgeStore;
    searchIndex?: KnowledgeSearchIndex;
    audit?: AuditSink;
    actorId?: string;
    id?: () => string;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = createArticleInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "knowledge-base-rag.INVALID_ARTICLE_INPUT", message: "Knowledge article input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const nowIso = isoFrom(deps.now);
  let article: KnowledgeArticle = {
    id: deps.id?.() ?? generatedId("kba"),
    tenantId: parsed.data.tenantId,
    projectId: parsed.data.projectId ?? null,
    title: parsed.data.title.trim(),
    content: parsed.data.content.trim(),
    sourceType: parsed.data.sourceType,
    sourceUrl: parsed.data.sourceUrl ?? null,
    wordCount: countWords(parsed.data.content),
    attachmentCount: 0,
    status: "active",
    indexedAt: null,
    indexingError: null,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  await deps.store.insertArticle(article);

  if (deps.searchIndex) {
    try {
      await deps.searchIndex.upsertArticle(article);
      article = { ...article, indexedAt: nowIso, indexingError: null };
      await deps.store.updateArticle(article);
    } catch (error) {
      article = { ...article, indexingError: errorMessage(error) };
      await deps.store.updateArticle(article);
    }
  }

  const event: DomainEvent = {
    name: "knowledge-base-rag.article_created",
    correlationId: meta.correlationId,
    payload: { id: article.id, tenantId: article.tenantId, projectId: article.projectId, sourceType: article.sourceType }
  };
  await deps.store.writeEvent(event);
  if (deps.audit && deps.actorId) {
    await deps.audit.record({ action: "knowledge.article_created", actorId: deps.actorId, entityType: "knowledge_article", entityId: article.id });
  }

  return ok(201, { article, event }, meta);
}

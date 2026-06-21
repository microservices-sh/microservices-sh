import { err, ok } from "@microservices-sh/connection-contract";
import { attachArticleFileInputSchema } from "../schemas";
import { knowledgeBaseRagMeta } from "../meta";
import type { KnowledgeStore } from "../ports";
import type { DomainEvent, KnowledgeAttachment } from "../types";
import { generatedId, isoFrom } from "./helpers";

export async function attachArticleFile(
  input: unknown,
  deps: {
    store: KnowledgeStore;
    id?: () => string;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = attachArticleFileInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_ATTACHMENT_INPUT", message: "Knowledge attachment input is invalid.", issues: parsed.error.issues }, meta);
  }

  const articleId = parsed.data.articleId ?? null;
  if (articleId) {
    const article = await deps.store.getArticle(articleId);
    if (!article || article.tenantId !== parsed.data.tenantId) {
      return err(404, { code: "knowledge-base-rag.ARTICLE_NOT_FOUND", message: "Knowledge article not found." }, meta);
    }
  }

  const nowIso = isoFrom(deps.now);
  const attachment: KnowledgeAttachment = {
    id: deps.id?.() ?? generatedId("kbf"),
    tenantId: parsed.data.tenantId,
    projectId: parsed.data.projectId ?? null,
    articleId,
    filename: parsed.data.filename,
    originalFilename: parsed.data.originalFilename,
    contentType: parsed.data.contentType,
    sizeBytes: parsed.data.sizeBytes,
    storageKey: parsed.data.storageKey,
    attachmentType: parsed.data.attachmentType,
    extractedText: parsed.data.extractedText ?? null,
    transcription: parsed.data.transcription ?? null,
    imageDescription: parsed.data.imageDescription ?? null,
    processingStatus: parsed.data.processingStatus,
    processingError: parsed.data.processingError ?? null,
    createdAt: nowIso,
    updatedAt: nowIso,
    processedAt: parsed.data.processingStatus === "completed" || parsed.data.processingStatus === "failed" ? nowIso : null
  };

  await deps.store.insertAttachment(attachment);
  if (articleId) {
    const article = await deps.store.getArticle(articleId);
    if (article) await deps.store.updateArticle({ ...article, attachmentCount: article.attachmentCount + 1, updatedAt: nowIso });
  }

  const event: DomainEvent = {
    name: "knowledge-base-rag.attachment_added",
    correlationId: meta.correlationId,
    payload: { id: attachment.id, tenantId: attachment.tenantId, articleId: attachment.articleId, attachmentType: attachment.attachmentType }
  };
  await deps.store.writeEvent(event);
  return ok(201, { attachment, event }, meta);
}

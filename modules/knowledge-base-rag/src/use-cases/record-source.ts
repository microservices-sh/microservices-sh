import { err, ok } from "@microservices-sh/connection-contract";
import { recordSourceInputSchema } from "../schemas";
import { knowledgeBaseRagMeta } from "../meta";
import type { KnowledgeStore } from "../ports";
import type { DomainEvent, KnowledgeSource } from "../types";
import { generatedId, isoFrom } from "./helpers";

export async function recordSource(
  input: unknown,
  deps: {
    store: KnowledgeStore;
    id?: () => string;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = recordSourceInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_SOURCE_INPUT", message: "Knowledge source input is invalid.", issues: parsed.error.issues }, meta);
  }

  const nowIso = isoFrom(deps.now);
  const source: KnowledgeSource = {
    id: deps.id?.() ?? generatedId("kbs"),
    tenantId: parsed.data.tenantId,
    projectId: parsed.data.projectId ?? null,
    sourceType: parsed.data.sourceType,
    sourceName: parsed.data.sourceName,
    sourceUrl: parsed.data.sourceUrl ?? null,
    status: parsed.data.status,
    errorMessage: parsed.data.errorMessage ?? null,
    articleId: parsed.data.articleId ?? null,
    attachmentId: parsed.data.attachmentId ?? null,
    fileSizeBytes: parsed.data.fileSizeBytes ?? null,
    contentType: parsed.data.contentType ?? null,
    createdAt: nowIso,
    processedAt: parsed.data.status === "completed" || parsed.data.status === "failed" ? nowIso : null
  };

  await deps.store.insertSource(source);
  const event: DomainEvent = {
    name: "knowledge-base-rag.source_recorded",
    correlationId: meta.correlationId,
    payload: { id: source.id, tenantId: source.tenantId, sourceType: source.sourceType, status: source.status }
  };
  await deps.store.writeEvent(event);
  return ok(201, { source, event }, meta);
}

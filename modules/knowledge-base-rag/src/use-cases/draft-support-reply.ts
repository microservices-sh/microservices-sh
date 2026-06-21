import { err, ok } from "@microservices-sh/connection-contract";
import { knowledgeBaseRagMeta } from "../meta";
import type { AnswerSynthesizer, AuditSink, KnowledgeSearchIndex, KnowledgeStore, SupportReplySink } from "../ports";
import { draftSupportReplyInputSchema } from "../schemas";
import type { SupportReplyDraft } from "../types";
import { answerQuestion } from "./answer-question";

export async function draftSupportReply(
  input: unknown,
  deps: {
    store: KnowledgeStore;
    synthesizer: AnswerSynthesizer;
    searchIndex?: KnowledgeSearchIndex;
    supportReplySink?: SupportReplySink;
    audit?: AuditSink;
    actorId?: string;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = draftSupportReplyInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_SUPPORT_REPLY_INPUT", message: "Support reply input is invalid.", issues: parsed.error.issues }, meta);
  }

  const question = `${parsed.data.subject}\n\n${parsed.data.description}`.trim();
  const answered = await answerQuestion(
    {
      tenantId: parsed.data.tenantId,
      projectId: parsed.data.projectId,
      query: question,
      supportContext: parsed.data.description,
      limit: parsed.data.limit
    },
    deps
  );
  if (!answered.ok) return answered;

  const draft: SupportReplyDraft = {
    ticketId: parsed.data.ticketId ?? null,
    question,
    answer: answered.data.answer.answer,
    citations: answered.data.answer.citations,
    status: "draft"
  };

  await deps.supportReplySink?.saveDraft?.(draft);
  if (deps.audit && deps.actorId) {
    await deps.audit.record({
      action: "knowledge.support_reply_drafted",
      actorId: deps.actorId,
      entityType: "support_ticket",
      entityId: draft.ticketId ?? "unlinked"
    });
  }

  return ok(200, { draft, passages: answered.data.passages }, meta);
}

import { err, ok } from "@microservices-sh/connection-contract";
import { defaultConfig } from "../config";
import { knowledgeBaseRagMeta } from "../meta";
import type { AnswerSynthesizer, AuditSink, KnowledgeSearchIndex, KnowledgeStore } from "../ports";
import { answerQuestionInputSchema } from "../schemas";
import type { GroundedAnswer, KnowledgeCitation } from "../types";

export async function answerQuestion(
  input: unknown,
  deps: {
    store: KnowledgeStore;
    synthesizer: AnswerSynthesizer;
    searchIndex?: KnowledgeSearchIndex;
    audit?: AuditSink;
    actorId?: string;
    config?: Partial<typeof defaultConfig>;
    correlationId?: string;
    now?: () => number;
  }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = answerQuestionInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_QUESTION_INPUT", message: "Knowledge question input is invalid.", issues: parsed.error.issues }, meta);
  }

  const cfg = { ...defaultConfig, ...deps.config };
  const limit = Math.min(parsed.data.limit ?? cfg.defaultSearchLimit, cfg.maxSearchLimit);
  const searchInput = { tenantId: parsed.data.tenantId, projectId: parsed.data.projectId, query: parsed.data.query, limit };
  const passages = deps.searchIndex ? await deps.searchIndex.search(searchInput) : await deps.store.searchArticles(searchInput);

  if (passages.length === 0) {
    return err(422, { code: "knowledge-base-rag.NO_GROUNDED_SOURCES", message: "No active knowledge article grounds this question." }, meta);
  }

  const synthesis = await deps.synthesizer.synthesize({
    question: parsed.data.query,
    supportContext: parsed.data.supportContext,
    passages
  });

  const retrieved = new Map(passages.map((passage) => [passage.articleId, passage]));
  const citedIds = [...new Set(synthesis.citedArticleIds)];
  const grounded = citedIds.length >= cfg.minAnswerCitations && citedIds.every((id) => retrieved.has(id));
  if (!synthesis.answer.trim() || !grounded) {
    return err(
      422,
      {
        code: "knowledge-base-rag.ANSWER_NOT_GROUNDED",
        message: "The answer did not cite retrieved knowledge articles; refusing to draft.",
        issues: [{ citedArticleIds: citedIds, retrievedArticleIds: [...retrieved.keys()] }]
      },
      meta
    );
  }

  const citations: KnowledgeCitation[] = citedIds.map((id) => {
    const passage = retrieved.get(id)!;
    return { articleId: passage.articleId, title: passage.title, sourceUrl: passage.sourceUrl };
  });

  const answer: GroundedAnswer = {
    question: parsed.data.query,
    answer: synthesis.answer.trim(),
    citations,
    status: "draft"
  };

  if (deps.audit && deps.actorId) {
    await deps.audit.record({ action: "knowledge.answer_drafted", actorId: deps.actorId, entityType: "knowledge_answer", entityId: citedIds.join(",") });
  }

  return ok(200, { answer, passages }, meta);
}

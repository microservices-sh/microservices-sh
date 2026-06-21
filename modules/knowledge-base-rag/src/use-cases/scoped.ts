import { enforceScope, err } from "@microservices-sh/connection-contract";
import type { AuthContext } from "@microservices-sh/connection-contract";
import {
  articleIdSchema,
  knowledgeFeedIdSchema,
  updateArticleInputSchema,
  updateKnowledgeFeedInputSchema,
  updateWebScanJobInputSchema,
  webScanJobIdSchema
} from "../schemas";
import { knowledgeBaseRagMeta } from "../meta";
import { attachArticleFile } from "./attach-article-file";
import { answerQuestion } from "./answer-question";
import { createArticle } from "./create-article";
import { createKnowledgeFeed } from "./create-knowledge-feed";
import { createWebScanJob } from "./create-web-scan-job";
import { draftSupportReply } from "./draft-support-reply";
import { getArticle } from "./get-article";
import { listAttachments } from "./list-attachments";
import { listArticles } from "./list-articles";
import { listKnowledgeFeeds } from "./list-knowledge-feeds";
import { listSources } from "./list-sources";
import { listWebScanJobs } from "./list-web-scan-jobs";
import { recordSource } from "./record-source";
import { searchKnowledge } from "./search-knowledge";
import { updateArticle } from "./update-article";
import { updateKnowledgeFeed } from "./update-knowledge-feed";
import { updateWebScanJob } from "./update-web-scan-job";
import { requireScope, tenantInput } from "./helpers";
import type { AnswerSynthesizer, AuditSink, KnowledgeSearchIndex, KnowledgeStore, SupportReplySink } from "../ports";

type ScopedDeps = {
  store: KnowledgeStore;
  synthesizer?: AnswerSynthesizer;
  searchIndex?: KnowledgeSearchIndex;
  supportReplySink?: SupportReplySink;
  audit?: AuditSink;
  now?: () => number;
  correlationId?: string;
};

async function ensureArticleInScope(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const idParsed = articleIdSchema.safeParse(input);
  if (!idParsed.success) return null;
  const article = await deps.store.getArticle(idParsed.data.id);
  if (!article || !enforceScope(ctx, article.tenantId, { assert: false })) {
    return err(404, { code: "knowledge-base-rag.ARTICLE_NOT_FOUND", message: "Knowledge article not found." }, knowledgeBaseRagMeta(deps));
  }
  return null;
}

async function ensureWebScanJobInScope(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const idParsed = webScanJobIdSchema.safeParse(input);
  if (!idParsed.success) return null;
  const job = await deps.store.getWebScanJob(idParsed.data.id);
  if (!job || !enforceScope(ctx, job.tenantId, { assert: false })) {
    return err(404, { code: "knowledge-base-rag.WEB_SCAN_JOB_NOT_FOUND", message: "Web scan job not found." }, knowledgeBaseRagMeta(deps));
  }
  return null;
}

async function ensureKnowledgeFeedInScope(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const idParsed = knowledgeFeedIdSchema.safeParse(input);
  if (!idParsed.success) return null;
  const feed = await deps.store.getKnowledgeFeed(idParsed.data.id);
  if (!feed || !enforceScope(ctx, feed.tenantId, { assert: false })) {
    return err(404, { code: "knowledge-base-rag.FEED_NOT_FOUND", message: "Knowledge feed not found." }, knowledgeBaseRagMeta(deps));
  }
  return null;
}

export async function createArticleScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return createArticle(tenantInput(ctx, input), { ...deps, actorId: ctx.actorId });
}

export async function getArticleScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const leak = await ensureArticleInScope(ctx, input, deps);
  if (leak) return leak;
  return getArticle(input, deps);
}

export async function listArticlesScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return listArticles(tenantInput(ctx, input), deps);
}

export async function listSourcesScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return listSources(tenantInput(ctx, input), deps);
}

export async function listAttachmentsScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return listAttachments(tenantInput(ctx, input), deps);
}

export async function createWebScanJobScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return createWebScanJob(tenantInput(ctx, input), deps);
}

export async function listWebScanJobsScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return listWebScanJobs(tenantInput(ctx, input), deps);
}

export async function updateWebScanJobScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const parsed = updateWebScanJobInputSchema.safeParse(input);
  const leak = parsed.success ? await ensureWebScanJobInScope(ctx, { id: parsed.data.id }, deps) : null;
  if (leak) return leak;
  return updateWebScanJob(input, deps);
}

export async function createKnowledgeFeedScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return createKnowledgeFeed(tenantInput(ctx, input), deps);
}

export async function listKnowledgeFeedsScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return listKnowledgeFeeds(tenantInput(ctx, input), deps);
}

export async function updateKnowledgeFeedScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const parsed = updateKnowledgeFeedInputSchema.safeParse(input);
  const leak = parsed.success ? await ensureKnowledgeFeedInScope(ctx, { id: parsed.data.id }, deps) : null;
  if (leak) return leak;
  return updateKnowledgeFeed(input, deps);
}

export async function updateArticleScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  const parsed = updateArticleInputSchema.safeParse(input);
  const leak = parsed.success ? await ensureArticleInScope(ctx, { id: parsed.data.id }, deps) : null;
  if (leak) return leak;
  return updateArticle(input, { ...deps, actorId: ctx.actorId });
}

export async function searchKnowledgeScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return searchKnowledge(tenantInput(ctx, input), deps);
}

export async function answerQuestionScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps & { synthesizer: AnswerSynthesizer }) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return answerQuestion(tenantInput(ctx, input), { ...deps, actorId: ctx.actorId });
}

export async function draftSupportReplyScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps & { synthesizer: AnswerSynthesizer }) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return draftSupportReply(tenantInput(ctx, input), { ...deps, actorId: ctx.actorId });
}

export async function recordSourceScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return recordSource(tenantInput(ctx, input), deps);
}

export async function attachArticleFileScoped(ctx: AuthContext, input: unknown, deps: ScopedDeps) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return attachArticleFile(tenantInput(ctx, input), deps);
}

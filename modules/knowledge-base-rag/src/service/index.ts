import { err } from "@microservices-sh/connection-contract";
import type { AuthContext } from "@microservices-sh/connection-contract";
import { attachArticleFile } from "../use-cases/attach-article-file";
import { answerQuestion } from "../use-cases/answer-question";
import { createArticle } from "../use-cases/create-article";
import { createKnowledgeFeed } from "../use-cases/create-knowledge-feed";
import { createWebScanJob } from "../use-cases/create-web-scan-job";
import { draftSupportReply } from "../use-cases/draft-support-reply";
import { getArticle } from "../use-cases/get-article";
import { listArticles } from "../use-cases/list-articles";
import { listAttachments } from "../use-cases/list-attachments";
import { listKnowledgeFeeds } from "../use-cases/list-knowledge-feeds";
import { listSources } from "../use-cases/list-sources";
import { listWebScanJobs } from "../use-cases/list-web-scan-jobs";
import { recordSource } from "../use-cases/record-source";
import { searchKnowledge } from "../use-cases/search-knowledge";
import { updateArticle } from "../use-cases/update-article";
import { updateKnowledgeFeed } from "../use-cases/update-knowledge-feed";
import { updateWebScanJob } from "../use-cases/update-web-scan-job";
import {
  answerQuestionScoped,
  attachArticleFileScoped,
  createArticleScoped,
  createKnowledgeFeedScoped,
  createWebScanJobScoped,
  draftSupportReplyScoped,
  getArticleScoped,
  listArticlesScoped,
  listAttachmentsScoped,
  listKnowledgeFeedsScoped,
  listSourcesScoped,
  listWebScanJobsScoped,
  recordSourceScoped,
  searchKnowledgeScoped,
  updateArticleScoped,
  updateKnowledgeFeedScoped,
  updateWebScanJobScoped
} from "../use-cases/scoped";
import { defaultConfig } from "../config";
import { knowledgeBaseRagMeta } from "../meta";
import type { AnswerSynthesizer, AuditSink, KnowledgeSearchIndex, KnowledgeStore, SupportReplySink } from "../ports";

export type KnowledgeBaseRagServiceDeps = {
  store: KnowledgeStore;
  searchIndex?: KnowledgeSearchIndex;
  synthesizer?: AnswerSynthesizer;
  supportReplySink?: SupportReplySink;
  audit?: AuditSink;
  actorId?: string;
  config?: Partial<typeof defaultConfig>;
  now?: () => number;
  correlationId?: string;
};

function synthesizerMissing(deps: KnowledgeBaseRagServiceDeps) {
  return err(
    500,
    {
      code: "knowledge-base-rag.SYNTHESIZER_NOT_CONFIGURED",
      message: "A knowledge answer synthesizer is required for this operation."
    },
    knowledgeBaseRagMeta(deps)
  );
}

function requireSynthesizer(deps: KnowledgeBaseRagServiceDeps) {
  return deps.synthesizer ? { ...deps, synthesizer: deps.synthesizer } : null;
}

export function createKnowledgeBaseRagService(deps: KnowledgeBaseRagServiceDeps) {
  return {
    createArticle: (input: unknown) => createArticle(input, deps),
    getArticle: (input: unknown) => getArticle(input, deps),
    listArticles: (input: unknown) => listArticles(input, deps),
    updateArticle: (input: unknown) => updateArticle(input, deps),
    recordSource: (input: unknown) => recordSource(input, deps),
    listSources: (input: unknown) => listSources(input, deps),
    attachArticleFile: (input: unknown) => attachArticleFile(input, deps),
    listAttachments: (input: unknown) => listAttachments(input, deps),
    createWebScanJob: (input: unknown) => createWebScanJob(input, deps),
    listWebScanJobs: (input: unknown) => listWebScanJobs(input, deps),
    updateWebScanJob: (input: unknown) => updateWebScanJob(input, deps),
    createKnowledgeFeed: (input: unknown) => createKnowledgeFeed(input, deps),
    listKnowledgeFeeds: (input: unknown) => listKnowledgeFeeds(input, deps),
    updateKnowledgeFeed: (input: unknown) => updateKnowledgeFeed(input, deps),
    searchKnowledge: (input: unknown) => searchKnowledge(input, deps),
    answerQuestion: (input: unknown) => {
      const withSynthesizer = requireSynthesizer(deps);
      return withSynthesizer ? answerQuestion(input, withSynthesizer) : synthesizerMissing(deps);
    },
    draftSupportReply: (input: unknown) => {
      const withSynthesizer = requireSynthesizer(deps);
      return withSynthesizer ? draftSupportReply(input, withSynthesizer) : synthesizerMissing(deps);
    }
  };
}

export function createKnowledgeBaseRagScopedService(ctx: AuthContext, deps: KnowledgeBaseRagServiceDeps) {
  return {
    createArticle: (input: unknown) => createArticleScoped(ctx, input, deps),
    getArticle: (input: unknown) => getArticleScoped(ctx, input, deps),
    listArticles: (input: unknown) => listArticlesScoped(ctx, input, deps),
    updateArticle: (input: unknown) => updateArticleScoped(ctx, input, deps),
    recordSource: (input: unknown) => recordSourceScoped(ctx, input, deps),
    listSources: (input: unknown) => listSourcesScoped(ctx, input, deps),
    attachArticleFile: (input: unknown) => attachArticleFileScoped(ctx, input, deps),
    listAttachments: (input: unknown) => listAttachmentsScoped(ctx, input, deps),
    createWebScanJob: (input: unknown) => createWebScanJobScoped(ctx, input, deps),
    listWebScanJobs: (input: unknown) => listWebScanJobsScoped(ctx, input, deps),
    updateWebScanJob: (input: unknown) => updateWebScanJobScoped(ctx, input, deps),
    createKnowledgeFeed: (input: unknown) => createKnowledgeFeedScoped(ctx, input, deps),
    listKnowledgeFeeds: (input: unknown) => listKnowledgeFeedsScoped(ctx, input, deps),
    updateKnowledgeFeed: (input: unknown) => updateKnowledgeFeedScoped(ctx, input, deps),
    searchKnowledge: (input: unknown) => searchKnowledgeScoped(ctx, input, deps),
    answerQuestion: (input: unknown) => {
      const withSynthesizer = requireSynthesizer(deps);
      return withSynthesizer ? answerQuestionScoped(ctx, input, withSynthesizer) : synthesizerMissing(deps);
    },
    draftSupportReply: (input: unknown) => {
      const withSynthesizer = requireSynthesizer(deps);
      return withSynthesizer ? draftSupportReplyScoped(ctx, input, withSynthesizer) : synthesizerMissing(deps);
    }
  };
}

export function getKnowledgeBaseRagModuleStatus() {
  return {
    id: "knowledge-base-rag",
    status: "draft",
    capabilities: [
      "article-curation",
      "source-tracking",
      "attachment-references",
      "web-scan-job-metadata",
      "feed-sync-metadata",
      "tenant-scoped-search",
      "cite-or-refuse-grounded-answers",
      "draft-only-support-replies"
    ]
  } as const;
}

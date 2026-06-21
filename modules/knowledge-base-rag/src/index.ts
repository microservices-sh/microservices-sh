export { manifest } from "./manifest";
export {
  answerQuestionInputSchema,
  articleIdSchema,
  articleSourceTypeSchema,
  articleStatusSchema,
  attachArticleFileInputSchema,
  createKnowledgeFeedInputSchema,
  createArticleInputSchema,
  createWebScanJobInputSchema,
  draftSupportReplyInputSchema,
  feedTypeSchema,
  knowledgeBaseRagConfigSchema,
  knowledgeFeedIdSchema,
  listAttachmentsInputSchema,
  listArticlesInputSchema,
  listKnowledgeFeedsInputSchema,
  listSourcesInputSchema,
  listWebScanJobsInputSchema,
  recordSourceInputSchema,
  searchKnowledgeInputSchema,
  sourceIdSchema,
  syncFrequencySchema,
  syncStatusSchema,
  updateArticleInputSchema,
  updateKnowledgeFeedInputSchema,
  updateWebScanJobInputSchema,
  webScanJobIdSchema
} from "./schemas";
export { defaultKnowledgeBaseRagHooks } from "./hooks";
export { knowledgeBaseRagEvents } from "./events";
export { knowledgeBaseRagPermissions } from "./permissions";
export { knowledgeBaseRagResources } from "./resources";
export { createKnowledgeBaseRagScopedService, createKnowledgeBaseRagService, getKnowledgeBaseRagModuleStatus } from "./service";
export type { KnowledgeBaseRagServiceDeps } from "./service";
export { createArticle } from "./use-cases/create-article";
export { createKnowledgeFeed } from "./use-cases/create-knowledge-feed";
export { createWebScanJob } from "./use-cases/create-web-scan-job";
export { getArticle } from "./use-cases/get-article";
export { listArticles } from "./use-cases/list-articles";
export { listAttachments } from "./use-cases/list-attachments";
export { listKnowledgeFeeds } from "./use-cases/list-knowledge-feeds";
export { listSources } from "./use-cases/list-sources";
export { listWebScanJobs } from "./use-cases/list-web-scan-jobs";
export { updateArticle } from "./use-cases/update-article";
export { updateKnowledgeFeed } from "./use-cases/update-knowledge-feed";
export { updateWebScanJob } from "./use-cases/update-web-scan-job";
export { recordSource } from "./use-cases/record-source";
export { attachArticleFile } from "./use-cases/attach-article-file";
export { searchKnowledge } from "./use-cases/search-knowledge";
export { answerQuestion } from "./use-cases/answer-question";
export { draftSupportReply } from "./use-cases/draft-support-reply";
export {
  answerQuestionScoped,
  attachArticleFileScoped,
  createArticleScoped,
  createKnowledgeFeedScoped,
  createWebScanJobScoped,
  draftSupportReplyScoped,
  getArticleScoped,
  listAttachmentsScoped,
  listArticlesScoped,
  listKnowledgeFeedsScoped,
  listSourcesScoped,
  listWebScanJobsScoped,
  recordSourceScoped,
  searchKnowledgeScoped,
  updateArticleScoped,
  updateKnowledgeFeedScoped,
  updateWebScanJobScoped
} from "./use-cases/scoped";
export { createD1KnowledgeStore } from "./adapters/d1-knowledge-store";
export { createEmbeddingKnowledgeSearchIndex } from "./adapters/embedding-knowledge-search-index";
export { createExtractiveSynthesizer } from "./adapters/extractive-synthesizer";
export { createGatewayAnswerSynthesizer } from "./adapters/gateway-answer-synthesizer";
export { createGatewayEmbeddingFn } from "./adapters/gateway-embedding";
export { createMemoryKnowledgeStore } from "./adapters/memory-knowledge-store";
export { createVectorizeStore } from "./adapters/vectorize-store";
export { authContext } from "@microservices-sh/connection-contract";
export type { AuthContext } from "@microservices-sh/connection-contract";
export type { AnswerSynthesizer, AuditSink, KnowledgeSearchIndex, KnowledgeStore, SupportReplySink } from "./ports";
export type { ChatMessage, CompleteFn, CompleteResult } from "./adapters/gateway-answer-synthesizer";
export type { EmbeddingFn, VectorRecord, VectorSearchMatch, VectorStore } from "./adapters/embedding-knowledge-search-index";
export type { GatewayEmbedFn, GatewayEmbedResult } from "./adapters/gateway-embedding";
export type { VectorizeBinding, VectorizeMetadataValue } from "./adapters/vectorize-store";
export type {
  ArticleSourceType,
  ArticleStatus,
  AttachmentType,
  DomainEvent,
  GroundedAnswer,
  KnowledgeArticle,
  KnowledgeArticleFilter,
  KnowledgeAttachment,
  KnowledgeAttachmentFilter,
  KnowledgeBaseRagConfig,
  KnowledgeCitation,
  KnowledgeFeed,
  KnowledgeFeedFilter,
  KnowledgeSource,
  KnowledgeSourceFilter,
  ProcessingStatus,
  SearchPassage,
  SourceStatus,
  SupportReplyDraft,
  SyncFrequency,
  SyncStatus,
  WebScanJob,
  WebScanJobFilter
} from "./types";

export const knowledgeBaseRagModule = {
  id: "knowledge-base-rag",
  version: "0.1.0"
} as const;

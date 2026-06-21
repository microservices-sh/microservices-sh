import type {
  DomainEvent,
  GroundedAnswer,
  KnowledgeArticle,
  KnowledgeArticleFilter,
  KnowledgeAttachmentFilter,
  KnowledgeAttachment,
  KnowledgeFeed,
  KnowledgeFeedFilter,
  KnowledgeSourceFilter,
  KnowledgeSource,
  SearchPassage,
  SupportReplyDraft,
  WebScanJob,
  WebScanJobFilter
} from "../types";

export interface KnowledgeStore {
  insertArticle(article: KnowledgeArticle): Promise<void>;
  getArticle(id: string): Promise<KnowledgeArticle | null>;
  updateArticle(article: KnowledgeArticle): Promise<void>;
  listArticles(filter: KnowledgeArticleFilter): Promise<KnowledgeArticle[]>;
  searchArticles(input: { tenantId: string; projectId?: string | null; query: string; limit: number }): Promise<SearchPassage[]>;

  insertSource(source: KnowledgeSource): Promise<void>;
  getSource(id: string): Promise<KnowledgeSource | null>;
  listSources(filter: KnowledgeSourceFilter): Promise<KnowledgeSource[]>;

  insertAttachment(attachment: KnowledgeAttachment): Promise<void>;
  listAttachments(filter: KnowledgeAttachmentFilter): Promise<KnowledgeAttachment[]>;

  insertWebScanJob(job: WebScanJob): Promise<void>;
  getWebScanJob(id: string): Promise<WebScanJob | null>;
  updateWebScanJob(job: WebScanJob): Promise<void>;
  listWebScanJobs(filter: WebScanJobFilter): Promise<WebScanJob[]>;

  insertKnowledgeFeed(feed: KnowledgeFeed): Promise<void>;
  getKnowledgeFeed(id: string): Promise<KnowledgeFeed | null>;
  updateKnowledgeFeed(feed: KnowledgeFeed): Promise<void>;
  listKnowledgeFeeds(filter: KnowledgeFeedFilter): Promise<KnowledgeFeed[]>;

  writeEvent(event: DomainEvent): Promise<void>;
}

export interface KnowledgeSearchIndex {
  upsertArticle(article: KnowledgeArticle): Promise<void>;
  removeArticle(article: KnowledgeArticle): Promise<void>;
  search(input: { tenantId: string; projectId?: string | null; query: string; limit: number }): Promise<SearchPassage[]>;
}

export interface AnswerSynthesizer {
  synthesize(input: { question: string; supportContext?: string; passages: SearchPassage[] }): Promise<{
    answer: string;
    citedArticleIds: string[];
  }>;
}

export interface AuditSink {
  record(entry: { action: string; actorId: string; entityType: string; entityId: string }): Promise<void>;
}

export interface SupportReplySink {
  saveDraft?(draft: SupportReplyDraft): Promise<void>;
}

export type GroundedAnswerResult = GroundedAnswer;

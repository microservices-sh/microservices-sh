export interface KnowledgeBaseRagConfig {
  enabled: boolean;
  defaultSearchLimit: number;
  maxSearchLimit: number;
  minAnswerCitations: number;
}

export type ArticleSourceType = "manual" | "web_scan" | "file_upload" | "api_sync";
export type ArticleStatus = "active" | "archived";
export type SourceStatus = "pending" | "processing" | "completed" | "failed";
export type AttachmentType = "document" | "image" | "video" | "audio";
export type ProcessingStatus = "pending" | "processing" | "completed" | "failed" | "skipped";
export type FeedType = "google_sheets" | "notion" | "airtable" | "csv_url";
export type SyncFrequency = "manual" | "hourly" | "daily" | "weekly";
export type SyncStatus = "pending" | "syncing" | "synced" | "failed";

export interface KnowledgeArticle {
  id: string;
  tenantId: string;
  projectId: string | null;
  title: string;
  content: string;
  sourceType: ArticleSourceType;
  sourceUrl: string | null;
  wordCount: number;
  attachmentCount: number;
  status: ArticleStatus;
  indexedAt: string | null;
  indexingError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeArticleFilter {
  tenantId: string;
  projectId?: string | null;
  status?: ArticleStatus | "all";
  search?: string;
  limit?: number;
}

export interface KnowledgeSourceFilter {
  tenantId: string;
  projectId?: string | null;
  status?: SourceStatus | "all";
  articleId?: string | null;
  attachmentId?: string | null;
  limit?: number;
}

export interface KnowledgeAttachmentFilter {
  tenantId: string;
  projectId?: string | null;
  articleId?: string | null;
  processingStatus?: ProcessingStatus | "all";
  limit?: number;
}

export interface WebScanJobFilter {
  tenantId: string;
  projectId?: string | null;
  status?: SourceStatus | "all";
  limit?: number;
}

export interface KnowledgeFeedFilter {
  tenantId: string;
  projectId?: string | null;
  feedType?: FeedType;
  syncStatus?: SyncStatus | "all";
  isActive?: boolean;
  limit?: number;
}

export interface KnowledgeAttachment {
  id: string;
  tenantId: string;
  projectId: string | null;
  articleId: string | null;
  filename: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  attachmentType: AttachmentType;
  extractedText: string | null;
  transcription: string | null;
  imageDescription: string | null;
  processingStatus: ProcessingStatus;
  processingError: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
}

export interface KnowledgeSource {
  id: string;
  tenantId: string;
  projectId: string | null;
  sourceType: ArticleSourceType;
  sourceName: string;
  sourceUrl: string | null;
  status: SourceStatus;
  errorMessage: string | null;
  articleId: string | null;
  attachmentId: string | null;
  fileSizeBytes: number | null;
  contentType: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface WebScanJob {
  id: string;
  tenantId: string;
  projectId: string | null;
  baseUrl: string;
  status: SourceStatus;
  pagesScanned: number;
  articlesCreated: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface KnowledgeFeed {
  id: string;
  tenantId: string;
  projectId: string | null;
  feedType: FeedType;
  name: string;
  sourceUrl: string;
  config: Record<string, unknown>;
  syncFrequency: SyncFrequency;
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  rowsTotal: number;
  articlesCreated: number;
  articlesUpdated: number;
  articlesDeleted: number;
  lastRowHash: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SearchPassage {
  articleId: string;
  title: string;
  excerpt: string;
  content: string;
  sourceUrl: string | null;
  score: number;
}

export interface KnowledgeCitation {
  articleId: string;
  title: string;
  sourceUrl: string | null;
}

export interface GroundedAnswer {
  question: string;
  answer: string;
  citations: KnowledgeCitation[];
  status: "draft";
}

export interface SupportReplyDraft extends GroundedAnswer {
  ticketId: string | null;
}

export interface DomainEvent {
  name: string;
  correlationId?: string | null;
  payload: Record<string, unknown>;
}

import type { KnowledgeStore } from "../ports";
import type {
  ArticleSourceType,
  ArticleStatus,
  AttachmentType,
  FeedType,
  KnowledgeArticle,
  KnowledgeAttachment,
  KnowledgeFeed,
  KnowledgeSource,
  ProcessingStatus,
  SearchPassage,
  SourceStatus,
  SyncFrequency,
  SyncStatus,
  WebScanJob
} from "../types";

const ARTICLE_COLS =
  "id, tenant_id, project_id, title, content, source_type, source_url, word_count, attachment_count, status, indexed_at, indexing_error, created_at, updated_at";
const SOURCE_COLS =
  "id, tenant_id, project_id, source_type, source_name, source_url, status, error_message, article_id, attachment_id, file_size_bytes, content_type, created_at, processed_at";
const ATTACHMENT_COLS =
  "id, tenant_id, project_id, article_id, filename, original_filename, content_type, size_bytes, storage_key, attachment_type, extracted_text, transcription, image_description, processing_status, processing_error, created_at, updated_at, processed_at";
const WEB_SCAN_JOB_COLS = "id, tenant_id, project_id, base_url, status, pages_scanned, articles_created, error, created_at, completed_at";
const FEED_COLS =
  "id, tenant_id, project_id, feed_type, name, source_url, config, sync_frequency, last_synced_at, next_sync_at, sync_status, sync_error, rows_total, articles_created, articles_updated, articles_deleted, last_row_hash, is_active, created_at, updated_at";

function rowToArticle(row: Record<string, unknown>): KnowledgeArticle {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    title: String(row.title),
    content: String(row.content),
    sourceType: String(row.source_type) as ArticleSourceType,
    sourceUrl: row.source_url == null ? null : String(row.source_url),
    wordCount: Number(row.word_count ?? 0),
    attachmentCount: Number(row.attachment_count ?? 0),
    status: String(row.status) as ArticleStatus,
    indexedAt: row.indexed_at == null ? null : String(row.indexed_at),
    indexingError: row.indexing_error == null ? null : String(row.indexing_error),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToSource(row: Record<string, unknown>): KnowledgeSource {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    sourceType: String(row.source_type) as ArticleSourceType,
    sourceName: String(row.source_name),
    sourceUrl: row.source_url == null ? null : String(row.source_url),
    status: String(row.status) as SourceStatus,
    errorMessage: row.error_message == null ? null : String(row.error_message),
    articleId: row.article_id == null ? null : String(row.article_id),
    attachmentId: row.attachment_id == null ? null : String(row.attachment_id),
    fileSizeBytes: row.file_size_bytes == null ? null : Number(row.file_size_bytes),
    contentType: row.content_type == null ? null : String(row.content_type),
    createdAt: String(row.created_at),
    processedAt: row.processed_at == null ? null : String(row.processed_at)
  };
}

function rowToAttachment(row: Record<string, unknown>): KnowledgeAttachment {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    articleId: row.article_id == null ? null : String(row.article_id),
    filename: String(row.filename),
    originalFilename: String(row.original_filename),
    contentType: String(row.content_type),
    sizeBytes: Number(row.size_bytes ?? 0),
    storageKey: String(row.storage_key),
    attachmentType: String(row.attachment_type) as AttachmentType,
    extractedText: row.extracted_text == null ? null : String(row.extracted_text),
    transcription: row.transcription == null ? null : String(row.transcription),
    imageDescription: row.image_description == null ? null : String(row.image_description),
    processingStatus: String(row.processing_status) as ProcessingStatus,
    processingError: row.processing_error == null ? null : String(row.processing_error),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    processedAt: row.processed_at == null ? null : String(row.processed_at)
  };
}

function safeJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || value.length === 0) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function rowToWebScanJob(row: Record<string, unknown>): WebScanJob {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    baseUrl: String(row.base_url),
    status: String(row.status) as SourceStatus,
    pagesScanned: Number(row.pages_scanned ?? 0),
    articlesCreated: Number(row.articles_created ?? 0),
    error: row.error == null ? null : String(row.error),
    createdAt: String(row.created_at),
    completedAt: row.completed_at == null ? null : String(row.completed_at)
  };
}

function rowToFeed(row: Record<string, unknown>): KnowledgeFeed {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    feedType: String(row.feed_type) as FeedType,
    name: String(row.name),
    sourceUrl: String(row.source_url),
    config: safeJsonObject(row.config),
    syncFrequency: String(row.sync_frequency) as SyncFrequency,
    lastSyncedAt: row.last_synced_at == null ? null : String(row.last_synced_at),
    nextSyncAt: row.next_sync_at == null ? null : String(row.next_sync_at),
    syncStatus: String(row.sync_status) as SyncStatus,
    syncError: row.sync_error == null ? null : String(row.sync_error),
    rowsTotal: Number(row.rows_total ?? 0),
    articlesCreated: Number(row.articles_created ?? 0),
    articlesUpdated: Number(row.articles_updated ?? 0),
    articlesDeleted: Number(row.articles_deleted ?? 0),
    lastRowHash: row.last_row_hash == null ? null : String(row.last_row_hash),
    isActive: Number(row.is_active ?? 0) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function escapeLike(value: string) {
  return `%${value.replace(/[%_\\]/g, "\\$&")}%`;
}

function excerpt(content: string, query: string) {
  const first = content.toLowerCase().indexOf(query.toLowerCase().split(/\s+/)[0] ?? "");
  const start = Math.max(0, first < 0 ? 0 : first - 80);
  const end = Math.min(content.length, start + 280);
  return `${start > 0 ? "..." : ""}${content.slice(start, end).trim()}${end < content.length ? "..." : ""}`;
}

export function createD1KnowledgeStore(db: D1Database): KnowledgeStore {
  return {
    async insertArticle(article) {
      await db
        .prepare(`INSERT INTO knowledge_articles (${ARTICLE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          article.id,
          article.tenantId,
          article.projectId,
          article.title,
          article.content,
          article.sourceType,
          article.sourceUrl,
          article.wordCount,
          article.attachmentCount,
          article.status,
          article.indexedAt,
          article.indexingError,
          article.createdAt,
          article.updatedAt
        )
        .run();
    },
    async getArticle(id) {
      const row = await db.prepare(`SELECT ${ARTICLE_COLS} FROM knowledge_articles WHERE id = ?`).bind(id).first<Record<string, unknown>>();
      return row ? rowToArticle(row) : null;
    },
    async updateArticle(article) {
      await db
        .prepare(
          "UPDATE knowledge_articles SET title = ?, content = ?, source_url = ?, word_count = ?, attachment_count = ?, status = ?, indexed_at = ?, indexing_error = ?, updated_at = ? WHERE id = ?"
        )
        .bind(
          article.title,
          article.content,
          article.sourceUrl,
          article.wordCount,
          article.attachmentCount,
          article.status,
          article.indexedAt,
          article.indexingError,
          article.updatedAt,
          article.id
        )
        .run();
    },
    async listArticles(filter) {
      const clauses = ["tenant_id = ?"];
      const values: unknown[] = [filter.tenantId];
      if (filter.projectId !== undefined) {
        if (filter.projectId === null) clauses.push("project_id IS NULL");
        else {
          clauses.push("project_id = ?");
          values.push(filter.projectId);
        }
      }
      if ((filter.status ?? "active") !== "all") {
        clauses.push("status = ?");
        values.push(filter.status ?? "active");
      }
      if (filter.search) {
        clauses.push("(title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')");
        values.push(escapeLike(filter.search), escapeLike(filter.search));
      }
      values.push(filter.limit ?? 100);
      const result = await db
        .prepare(`SELECT ${ARTICLE_COLS} FROM knowledge_articles WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT ?`)
        .bind(...values)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToArticle);
    },
    async searchArticles(input) {
      const like = escapeLike(input.query);
      const clauses = ["tenant_id = ?", "status = 'active'", "(title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')"];
      const values: unknown[] = [input.tenantId, like, like];
      if (input.projectId !== undefined) {
        if (input.projectId === null) clauses.push("project_id IS NULL");
        else {
          clauses.push("project_id = ?");
          values.push(input.projectId);
        }
      }
      values.push(input.limit);
      const result = await db
        .prepare(`SELECT ${ARTICLE_COLS} FROM knowledge_articles WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT ?`)
        .bind(...values)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map((row): SearchPassage => {
        const article = rowToArticle(row);
        return {
          articleId: article.id,
          title: article.title,
          excerpt: excerpt(article.content, input.query),
          content: article.content,
          sourceUrl: article.sourceUrl,
          score: 1
        };
      });
    },

    async insertSource(source) {
      await db
        .prepare(`INSERT INTO knowledge_sources (${SOURCE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          source.id,
          source.tenantId,
          source.projectId,
          source.sourceType,
          source.sourceName,
          source.sourceUrl,
          source.status,
          source.errorMessage,
          source.articleId,
          source.attachmentId,
          source.fileSizeBytes,
          source.contentType,
          source.createdAt,
          source.processedAt
        )
        .run();
    },
    async getSource(id) {
      const row = await db.prepare(`SELECT ${SOURCE_COLS} FROM knowledge_sources WHERE id = ?`).bind(id).first<Record<string, unknown>>();
      return row ? rowToSource(row) : null;
    },
    async listSources(filter) {
      const clauses = ["tenant_id = ?"];
      const values: unknown[] = [filter.tenantId];
      if (filter.projectId !== undefined) {
        if (filter.projectId === null) clauses.push("project_id IS NULL");
        else {
          clauses.push("project_id = ?");
          values.push(filter.projectId);
        }
      }
      if ((filter.status ?? "all") !== "all") {
        clauses.push("status = ?");
        values.push(filter.status);
      }
      if (filter.articleId !== undefined) {
        if (filter.articleId === null) clauses.push("article_id IS NULL");
        else {
          clauses.push("article_id = ?");
          values.push(filter.articleId);
        }
      }
      if (filter.attachmentId !== undefined) {
        if (filter.attachmentId === null) clauses.push("attachment_id IS NULL");
        else {
          clauses.push("attachment_id = ?");
          values.push(filter.attachmentId);
        }
      }
      values.push(filter.limit ?? 100);
      const result = await db
        .prepare(`SELECT ${SOURCE_COLS} FROM knowledge_sources WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`)
        .bind(...values)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToSource);
    },

    async insertAttachment(attachment) {
      await db
        .prepare(`INSERT INTO knowledge_attachments (${ATTACHMENT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          attachment.id,
          attachment.tenantId,
          attachment.projectId,
          attachment.articleId,
          attachment.filename,
          attachment.originalFilename,
          attachment.contentType,
          attachment.sizeBytes,
          attachment.storageKey,
          attachment.attachmentType,
          attachment.extractedText,
          attachment.transcription,
          attachment.imageDescription,
          attachment.processingStatus,
          attachment.processingError,
          attachment.createdAt,
          attachment.updatedAt,
          attachment.processedAt
        )
        .run();
    },
    async listAttachments(filter) {
      const clauses = ["tenant_id = ?"];
      const values: unknown[] = [filter.tenantId];
      if (filter.projectId !== undefined) {
        if (filter.projectId === null) clauses.push("project_id IS NULL");
        else {
          clauses.push("project_id = ?");
          values.push(filter.projectId);
        }
      }
      if (filter.articleId !== undefined) {
        if (filter.articleId === null) clauses.push("article_id IS NULL");
        else {
          clauses.push("article_id = ?");
          values.push(filter.articleId);
        }
      }
      if ((filter.processingStatus ?? "all") !== "all") {
        clauses.push("processing_status = ?");
        values.push(filter.processingStatus);
      }
      values.push(filter.limit ?? 100);
      const result = await db
        .prepare(`SELECT ${ATTACHMENT_COLS} FROM knowledge_attachments WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`)
        .bind(...values)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToAttachment);
    },

    async insertWebScanJob(job) {
      await db
        .prepare(`INSERT INTO knowledge_web_scan_jobs (${WEB_SCAN_JOB_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          job.id,
          job.tenantId,
          job.projectId,
          job.baseUrl,
          job.status,
          job.pagesScanned,
          job.articlesCreated,
          job.error,
          job.createdAt,
          job.completedAt
        )
        .run();
    },
    async getWebScanJob(id) {
      const row = await db.prepare(`SELECT ${WEB_SCAN_JOB_COLS} FROM knowledge_web_scan_jobs WHERE id = ?`).bind(id).first<Record<string, unknown>>();
      return row ? rowToWebScanJob(row) : null;
    },
    async updateWebScanJob(job) {
      await db
        .prepare(
          "UPDATE knowledge_web_scan_jobs SET status = ?, pages_scanned = ?, articles_created = ?, error = ?, completed_at = ? WHERE id = ?"
        )
        .bind(job.status, job.pagesScanned, job.articlesCreated, job.error, job.completedAt, job.id)
        .run();
    },
    async listWebScanJobs(filter) {
      const clauses = ["tenant_id = ?"];
      const values: unknown[] = [filter.tenantId];
      if (filter.projectId !== undefined) {
        if (filter.projectId === null) clauses.push("project_id IS NULL");
        else {
          clauses.push("project_id = ?");
          values.push(filter.projectId);
        }
      }
      if ((filter.status ?? "all") !== "all") {
        clauses.push("status = ?");
        values.push(filter.status);
      }
      values.push(filter.limit ?? 100);
      const result = await db
        .prepare(`SELECT ${WEB_SCAN_JOB_COLS} FROM knowledge_web_scan_jobs WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`)
        .bind(...values)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToWebScanJob);
    },

    async insertKnowledgeFeed(feed) {
      await db
        .prepare(`INSERT INTO knowledge_feeds (${FEED_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          feed.id,
          feed.tenantId,
          feed.projectId,
          feed.feedType,
          feed.name,
          feed.sourceUrl,
          JSON.stringify(feed.config),
          feed.syncFrequency,
          feed.lastSyncedAt,
          feed.nextSyncAt,
          feed.syncStatus,
          feed.syncError,
          feed.rowsTotal,
          feed.articlesCreated,
          feed.articlesUpdated,
          feed.articlesDeleted,
          feed.lastRowHash,
          feed.isActive ? 1 : 0,
          feed.createdAt,
          feed.updatedAt
        )
        .run();
    },
    async getKnowledgeFeed(id) {
      const row = await db.prepare(`SELECT ${FEED_COLS} FROM knowledge_feeds WHERE id = ?`).bind(id).first<Record<string, unknown>>();
      return row ? rowToFeed(row) : null;
    },
    async updateKnowledgeFeed(feed) {
      await db
        .prepare(
          "UPDATE knowledge_feeds SET name = ?, source_url = ?, config = ?, sync_frequency = ?, last_synced_at = ?, next_sync_at = ?, sync_status = ?, sync_error = ?, rows_total = ?, articles_created = ?, articles_updated = ?, articles_deleted = ?, last_row_hash = ?, is_active = ?, updated_at = ? WHERE id = ?"
        )
        .bind(
          feed.name,
          feed.sourceUrl,
          JSON.stringify(feed.config),
          feed.syncFrequency,
          feed.lastSyncedAt,
          feed.nextSyncAt,
          feed.syncStatus,
          feed.syncError,
          feed.rowsTotal,
          feed.articlesCreated,
          feed.articlesUpdated,
          feed.articlesDeleted,
          feed.lastRowHash,
          feed.isActive ? 1 : 0,
          feed.updatedAt,
          feed.id
        )
        .run();
    },
    async listKnowledgeFeeds(filter) {
      const clauses = ["tenant_id = ?"];
      const values: unknown[] = [filter.tenantId];
      if (filter.projectId !== undefined) {
        if (filter.projectId === null) clauses.push("project_id IS NULL");
        else {
          clauses.push("project_id = ?");
          values.push(filter.projectId);
        }
      }
      if (filter.feedType !== undefined) {
        clauses.push("feed_type = ?");
        values.push(filter.feedType);
      }
      if ((filter.syncStatus ?? "all") !== "all") {
        clauses.push("sync_status = ?");
        values.push(filter.syncStatus);
      }
      if (filter.isActive !== undefined) {
        clauses.push("is_active = ?");
        values.push(filter.isActive ? 1 : 0);
      }
      values.push(filter.limit ?? 100);
      const result = await db
        .prepare(`SELECT ${FEED_COLS} FROM knowledge_feeds WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT ?`)
        .bind(...values)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToFeed);
    },

    async writeEvent(event) {
      await db
        .prepare("INSERT INTO domain_events (id, event_name, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(
          "evt_" + crypto.randomUUID().slice(0, 16),
          event.name,
          "knowledge-base-rag",
          typeof event.payload.id === "string" ? event.payload.id : null,
          JSON.stringify({ correlationId: event.correlationId ?? null, ...event.payload }),
          new Date().toISOString()
        )
        .run();
    }
  };
}

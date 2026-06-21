import type { KnowledgeStore } from "../ports";
import type { DomainEvent, KnowledgeArticle, KnowledgeAttachment, KnowledgeFeed, KnowledgeSource, SearchPassage, WebScanJob } from "../types";

function cloneArticle(article: KnowledgeArticle): KnowledgeArticle {
  return { ...article };
}

function cloneSource(source: KnowledgeSource): KnowledgeSource {
  return { ...source };
}

function cloneAttachment(attachment: KnowledgeAttachment): KnowledgeAttachment {
  return { ...attachment };
}

function cloneWebScanJob(job: WebScanJob): WebScanJob {
  return { ...job };
}

function cloneFeed(feed: KnowledgeFeed): KnowledgeFeed {
  return { ...feed, config: { ...feed.config } };
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function excerpt(content: string, queryTokens: string[]) {
  const lower = content.toLowerCase();
  const first = queryTokens.map((token) => lower.indexOf(token)).filter((idx) => idx >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, first - 80);
  const end = Math.min(content.length, first + 220);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";
  return `${prefix}${content.slice(start, end).trim()}${suffix}`;
}

function scoreArticle(article: KnowledgeArticle, queryTokens: string[]) {
  const titleTokens = new Set(tokenize(article.title));
  const contentTokens = new Set(tokenize(article.content));
  let score = 0;
  for (const token of queryTokens) {
    if (titleTokens.has(token)) score += 3;
    if (contentTokens.has(token)) score += 1;
  }
  return score;
}

export type MemoryKnowledgeStore = KnowledgeStore & {
  listEvents(): DomainEvent[];
};

export function createMemoryKnowledgeStore(): MemoryKnowledgeStore {
  const articles = new Map<string, KnowledgeArticle>();
  const sources = new Map<string, KnowledgeSource>();
  const attachments = new Map<string, KnowledgeAttachment>();
  const webScanJobs = new Map<string, WebScanJob>();
  const feeds = new Map<string, KnowledgeFeed>();
  const events: DomainEvent[] = [];

  return {
    async insertArticle(article) {
      articles.set(article.id, cloneArticle(article));
    },
    async getArticle(id) {
      const article = articles.get(id);
      return article ? cloneArticle(article) : null;
    },
    async updateArticle(article) {
      if (articles.has(article.id)) articles.set(article.id, cloneArticle(article));
    },
    async listArticles(filter) {
      return [...articles.values()]
        .filter(
          (article) =>
            article.tenantId === filter.tenantId &&
            (filter.projectId === undefined ? true : article.projectId === filter.projectId) &&
            (filter.status === "all" ? true : article.status === (filter.status ?? "active")) &&
            (filter.search ? `${article.title}\n${article.content}`.toLowerCase().includes(filter.search.toLowerCase()) : true)
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, filter.limit ?? 100)
        .map(cloneArticle);
    },
    async searchArticles(input) {
      const queryTokens = tokenize(input.query);
      if (queryTokens.length === 0) return [];
      return [...articles.values()]
        .filter(
          (article) =>
            article.tenantId === input.tenantId &&
            article.status === "active" &&
            (input.projectId === undefined ? true : article.projectId === input.projectId)
        )
        .map((article) => ({ article, score: scoreArticle(article, queryTokens) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || b.article.updatedAt.localeCompare(a.article.updatedAt))
        .slice(0, input.limit)
        .map(({ article, score }): SearchPassage => ({
          articleId: article.id,
          title: article.title,
          excerpt: excerpt(article.content, queryTokens),
          content: article.content,
          sourceUrl: article.sourceUrl,
          score
        }));
    },

    async insertSource(source) {
      sources.set(source.id, cloneSource(source));
    },
    async getSource(id) {
      const source = sources.get(id);
      return source ? cloneSource(source) : null;
    },
    async listSources(filter) {
      return [...sources.values()]
        .filter(
          (source) =>
            source.tenantId === filter.tenantId &&
            (filter.projectId === undefined ? true : source.projectId === filter.projectId) &&
            (filter.status === undefined || filter.status === "all" ? true : source.status === filter.status) &&
            (filter.articleId === undefined ? true : source.articleId === filter.articleId) &&
            (filter.attachmentId === undefined ? true : source.attachmentId === filter.attachmentId)
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, filter.limit ?? 100)
        .map(cloneSource);
    },

    async insertAttachment(attachment) {
      attachments.set(attachment.id, cloneAttachment(attachment));
    },
    async listAttachments(filter) {
      return [...attachments.values()]
        .filter(
          (attachment) =>
            attachment.tenantId === filter.tenantId &&
            (filter.projectId === undefined ? true : attachment.projectId === filter.projectId) &&
            (filter.articleId === undefined ? true : attachment.articleId === filter.articleId) &&
            (filter.processingStatus === undefined || filter.processingStatus === "all" ? true : attachment.processingStatus === filter.processingStatus)
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, filter.limit ?? 100)
        .map(cloneAttachment);
    },

    async insertWebScanJob(job) {
      webScanJobs.set(job.id, cloneWebScanJob(job));
    },
    async getWebScanJob(id) {
      const job = webScanJobs.get(id);
      return job ? cloneWebScanJob(job) : null;
    },
    async updateWebScanJob(job) {
      if (webScanJobs.has(job.id)) webScanJobs.set(job.id, cloneWebScanJob(job));
    },
    async listWebScanJobs(filter) {
      return [...webScanJobs.values()]
        .filter(
          (job) =>
            job.tenantId === filter.tenantId &&
            (filter.projectId === undefined ? true : job.projectId === filter.projectId) &&
            (filter.status === undefined || filter.status === "all" ? true : job.status === filter.status)
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, filter.limit ?? 100)
        .map(cloneWebScanJob);
    },

    async insertKnowledgeFeed(feed) {
      feeds.set(feed.id, cloneFeed(feed));
    },
    async getKnowledgeFeed(id) {
      const feed = feeds.get(id);
      return feed ? cloneFeed(feed) : null;
    },
    async updateKnowledgeFeed(feed) {
      if (feeds.has(feed.id)) feeds.set(feed.id, cloneFeed(feed));
    },
    async listKnowledgeFeeds(filter) {
      return [...feeds.values()]
        .filter(
          (feed) =>
            feed.tenantId === filter.tenantId &&
            (filter.projectId === undefined ? true : feed.projectId === filter.projectId) &&
            (filter.feedType === undefined ? true : feed.feedType === filter.feedType) &&
            (filter.syncStatus === undefined || filter.syncStatus === "all" ? true : feed.syncStatus === filter.syncStatus) &&
            (filter.isActive === undefined ? true : feed.isActive === filter.isActive)
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, filter.limit ?? 100)
        .map(cloneFeed);
    },

    async writeEvent(event) {
      events.push({ ...event, payload: { ...event.payload } });
    },
    listEvents() {
      return events.map((event) => ({ ...event, payload: { ...event.payload } }));
    }
  };
}

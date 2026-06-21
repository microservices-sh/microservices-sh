import { describe, expect, it } from "vitest";
import { authContext } from "@microservices-sh/connection-contract";
import type { AuthContext } from "@microservices-sh/connection-contract";
import {
  answerQuestion,
  createArticle,
  createArticleScoped,
  createExtractiveSynthesizer,
  createKnowledgeFeed,
  createKnowledgeFeedScoped,
  createMemoryKnowledgeStore,
  createWebScanJob,
  createWebScanJobScoped,
  draftSupportReply,
  getArticle,
  getArticleScoped,
  attachArticleFile,
  listAttachments,
  listArticles,
  listArticlesScoped,
  listKnowledgeFeeds,
  listKnowledgeFeedsScoped,
  listSources,
  listWebScanJobs,
  listWebScanJobsScoped,
  recordSource,
  searchKnowledge,
  searchKnowledgeScoped,
  updateArticle,
  updateArticleScoped,
  updateKnowledgeFeed,
  updateKnowledgeFeedScoped,
  updateWebScanJob,
  updateWebScanJobScoped
} from "./index";
import type { AnswerSynthesizer, SupportReplySink } from "./index";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;
let seedCounter = 1;

const articleInput = {
  title: "Refund policy",
  content: "Customers may request a refund within 14 days when the order has not been fulfilled.",
  sourceType: "manual" as const
};

function idSeq(prefix = "kba") {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

async function seedArticle(
  store: ReturnType<typeof createMemoryKnowledgeStore>,
  tenantId: string,
  overrides: Partial<typeof articleInput> = {}
) {
  const created = await createArticle(
    {
      tenantId,
      ...articleInput,
      ...overrides
    },
    { store, now: fixedNow(T0), id: () => `${tenantId}-article-${seedCounter++}` }
  );
  if (!created.ok) throw new Error("seed article failed");
  return created.data.article;
}

describe("knowledge-base-rag: articles and search", () => {
  it("creates, reads, and lists articles without leaking other tenants", async () => {
    const store = createMemoryKnowledgeStore();
    const created = await createArticle(
      { tenantId: "tenant-1", ...articleInput },
      { store, now: fixedNow(T0), id: () => "article-1", correlationId: "corr-1" }
    );
    expect(created.ok).toBe(true);
    expect(created.status).toBe(201);
    expect(created.meta.correlationId).toBe("corr-1");
    if (!created.ok) throw new Error("create failed");

    await seedArticle(store, "tenant-2", { title: "Other tenant policy" });

    const got = await getArticle({ id: created.data.article.id }, { store });
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.data.article.tenantId).toBe("tenant-1");

    const listed = await listArticles({ tenantId: "tenant-1", status: "all" }, { store });
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data.count).toBe(1);
      expect(listed.data.articles.every((article) => article.tenantId === "tenant-1")).toBe(true);
    }

    expect(store.listEvents().map((event) => event.name)).toContain("knowledge-base-rag.article_created");
  });

  it("searches only active articles in the requested tenant", async () => {
    const store = createMemoryKnowledgeStore();
    const active = await seedArticle(store, "tenant-1", {
      title: "Warranty answers",
      content: "Warranty claims require a receipt and must be filed within 30 days of purchase."
    });
    const archived = await seedArticle(store, "tenant-1", {
      title: "Old warranty policy",
      content: "Warranty claims used to be accepted without receipts under the old process."
    });
    await seedArticle(store, "tenant-2", {
      title: "Tenant two warranty",
      content: "Warranty claims for another tenant must never appear in tenant one results."
    });
    await updateArticle({ id: archived.id, status: "archived" }, { store, now: fixedNow(T0 + 1000) });

    const searched = await searchKnowledge({ tenantId: "tenant-1", query: "warranty claims" }, { store });
    expect(searched.ok).toBe(true);
    if (searched.ok) {
      expect(searched.data.count).toBe(1);
      expect(searched.data.passages[0].articleId).toBe(active.id);
    }
  });

  it("lists source and attachment metadata without leaking other tenants", async () => {
    const store = createMemoryKnowledgeStore();
    const article = await seedArticle(store, "tenant-1", {
      title: "Source article",
      content: "Knowledge source metadata should be visible only to the owning tenant."
    });
    await recordSource(
      {
        tenantId: "tenant-1",
        sourceType: "web_scan",
        sourceName: "Help center",
        sourceUrl: "https://example.com/help",
        status: "completed",
        articleId: article.id
      },
      { store, id: () => "source-1", now: fixedNow(T0) }
    );
    await recordSource(
      {
        tenantId: "tenant-2",
        sourceType: "web_scan",
        sourceName: "Other help",
        status: "completed"
      },
      { store, id: () => "source-2", now: fixedNow(T0) }
    );
    await attachArticleFile(
      {
        tenantId: "tenant-1",
        articleId: article.id,
        filename: "refunds.pdf",
        originalFilename: "refunds.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
        storageKey: "tenant-1/refunds.pdf",
        attachmentType: "document",
        processingStatus: "completed",
        extractedText: "Refund instructions"
      },
      { store, id: () => "attachment-1", now: fixedNow(T0) }
    );
    await attachArticleFile(
      {
        tenantId: "tenant-2",
        filename: "foreign.pdf",
        originalFilename: "foreign.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
        storageKey: "tenant-2/foreign.pdf",
        attachmentType: "document",
        processingStatus: "completed"
      },
      { store, id: () => "attachment-2", now: fixedNow(T0) }
    );

    const sources = await listSources({ tenantId: "tenant-1", status: "completed" }, { store });
    expect(sources.ok).toBe(true);
    if (sources.ok) {
      expect(sources.data.sources.map((source) => source.id)).toEqual(["source-1"]);
      expect(sources.data.sources.every((source) => source.tenantId === "tenant-1")).toBe(true);
    }

    const attachments = await listAttachments(
      { tenantId: "tenant-1", articleId: article.id, processingStatus: "completed" },
      { store }
    );
    expect(attachments.ok).toBe(true);
    if (attachments.ok) {
      expect(attachments.data.attachments.map((attachment) => attachment.id)).toEqual(["attachment-1"]);
      expect(attachments.data.attachments[0].extractedText).toBe("Refund instructions");
    }
  });
});

describe("knowledge-base-rag: grounded answers", () => {
  it("drafts an answer only when cited article ids came from retrieved passages", async () => {
    const store = createMemoryKnowledgeStore();
    const article = await seedArticle(store, "tenant-1", {
      title: "Refund window",
      content: "The refund window is 14 days for eligible orders that have not been fulfilled."
    });

    const answered = await answerQuestion(
      { tenantId: "tenant-1", query: "What is the refund window?" },
      { store, synthesizer: createExtractiveSynthesizer() }
    );

    expect(answered.ok).toBe(true);
    if (answered.ok) {
      expect(answered.data.answer.status).toBe("draft");
      expect(answered.data.answer.citations).toEqual([
        { articleId: article.id, title: article.title, sourceUrl: null }
      ]);
      expect(answered.data.answer.answer).toContain("14 days");
    }
  });

  it("refuses when there are no retrieved sources", async () => {
    const store = createMemoryKnowledgeStore();
    const answered = await answerQuestion(
      { tenantId: "tenant-1", query: "How do refunds work?" },
      { store, synthesizer: createExtractiveSynthesizer() }
    );
    expect(answered.ok).toBe(false);
    expect(answered.status).toBe(422);
    if (!answered.ok) expect(answered.error.code).toBe("knowledge-base-rag.NO_GROUNDED_SOURCES");
  });

  it("refuses when the synthesizer does not cite retrieved sources", async () => {
    const store = createMemoryKnowledgeStore();
    await seedArticle(store, "tenant-1", {
      title: "Refund requirements",
      content: "Refund requests require an order id and must be made within 14 days."
    });
    const uncited: AnswerSynthesizer = {
      async synthesize() {
        return { answer: "Refunds are available.", citedArticleIds: [] };
      }
    };

    const answered = await answerQuestion(
      { tenantId: "tenant-1", query: "refund requests" },
      { store, synthesizer: uncited }
    );

    expect(answered.ok).toBe(false);
    expect(answered.status).toBe(422);
    if (!answered.ok) expect(answered.error.code).toBe("knowledge-base-rag.ANSWER_NOT_GROUNDED");
  });

  it("saves support replies as drafts only after grounding succeeds", async () => {
    const store = createMemoryKnowledgeStore();
    await seedArticle(store, "tenant-1", {
      title: "Login reset",
      content: "Agents should send the secure reset link when a customer cannot sign in."
    });
    const saved: unknown[] = [];
    const supportReplySink: SupportReplySink = {
      async saveDraft(draft) {
        saved.push(draft);
      }
    };

    const drafted = await draftSupportReply(
      {
        tenantId: "tenant-1",
        ticketId: "ticket-1",
        subject: "Cannot sign in",
        description: "The customer cannot sign in and needs a login reset."
      },
      { store, synthesizer: createExtractiveSynthesizer(), supportReplySink }
    );

    expect(drafted.ok).toBe(true);
    if (drafted.ok) {
      expect(drafted.data.draft.status).toBe("draft");
      expect(drafted.data.draft.ticketId).toBe("ticket-1");
      expect(drafted.data.draft.citations.length).toBeGreaterThan(0);
    }
    expect(saved).toHaveLength(1);

    const refused = await draftSupportReply(
      {
        tenantId: "tenant-1",
        ticketId: "ticket-2",
        subject: "Payroll codes",
        description: "No referenced source discusses payroll codes."
      },
      { store, synthesizer: createExtractiveSynthesizer(), supportReplySink }
    );
    expect(refused.ok).toBe(false);
    expect(saved).toHaveLength(1);
  });
});

describe("knowledge-base-rag: ingestion planning metadata", () => {
  it("creates, updates, and lists web scan jobs without executing crawls", async () => {
    const store = createMemoryKnowledgeStore();
    const created = await createWebScanJob(
      { tenantId: "tenant-1", projectId: "proj-1", baseUrl: "https://example.com/help" },
      { store, id: () => "scan-1", now: fixedNow(T0) }
    );
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("create scan failed");
    expect(created.data.job.status).toBe("pending");
    expect(created.data.job.pagesScanned).toBe(0);

    await createWebScanJob(
      { tenantId: "tenant-2", baseUrl: "https://other.example/help" },
      { store, id: () => "scan-2", now: fixedNow(T0) }
    );

    const updated = await updateWebScanJob(
      { id: "scan-1", status: "completed", pagesScanned: 8, articlesCreated: 3 },
      { store, now: fixedNow(T0 + 1000) }
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.job.completedAt).toBe(new Date(T0 + 1000).toISOString());
      expect(updated.data.job.articlesCreated).toBe(3);
    }

    const listed = await listWebScanJobs({ tenantId: "tenant-1", status: "completed" }, { store });
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.data.jobs.map((job) => job.id)).toEqual(["scan-1"]);
  });

  it("creates, updates, and lists feed sync configs without executing external syncs", async () => {
    const store = createMemoryKnowledgeStore();
    const created = await createKnowledgeFeed(
      {
        tenantId: "tenant-1",
        projectId: "proj-1",
        feedType: "csv_url",
        name: "FAQ CSV",
        sourceUrl: "https://example.com/faq.csv",
        config: { delimiter: "," },
        syncFrequency: "daily"
      },
      { store, id: () => "feed-1", now: fixedNow(T0) }
    );
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("create feed failed");
    expect(created.data.feed.syncStatus).toBe("pending");

    await createKnowledgeFeed(
      {
        tenantId: "tenant-2",
        feedType: "csv_url",
        name: "Other CSV",
        sourceUrl: "https://other.example/faq.csv"
      },
      { store, id: () => "feed-2", now: fixedNow(T0) }
    );

    const updated = await updateKnowledgeFeed(
      { id: "feed-1", syncStatus: "synced", rowsTotal: 12, articlesCreated: 4, lastRowHash: "abc" },
      { store, now: fixedNow(T0 + 2000) }
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.feed.lastSyncedAt).toBe(new Date(T0 + 2000).toISOString());
      expect(updated.data.feed.rowsTotal).toBe(12);
      expect(updated.data.feed.config).toEqual({ delimiter: "," });
    }

    const listed = await listKnowledgeFeeds({ tenantId: "tenant-1", syncStatus: "synced", isActive: true }, { store });
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.data.feeds.map((feed) => feed.id)).toEqual(["feed-1"]);
  });
});

describe("knowledge-base-rag: enforced tenant boundary", () => {
  it("scoped wrappers take tenant from AuthContext and hide foreign rows", async () => {
    const store = createMemoryKnowledgeStore();
    const ctxA = authContext({ orgId: "tenant-1", actorId: "agent-a" });
    const a1 = await seedArticle(store, "tenant-1", {
      title: "Tenant one returns",
      content: "Tenant one returns require the customer receipt."
    });
    const b1 = await seedArticle(store, "tenant-2", {
      title: "Tenant two returns",
      content: "Tenant two returns follow a different policy."
    });
    const deps = { store, now: fixedNow(T0 + 2000) };

    const listed = await listArticlesScoped(ctxA, { tenantId: "tenant-2", status: "all" }, deps);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data.count).toBe(1);
      expect(listed.data.articles[0].id).toBe(a1.id);
    }

    const searched = await searchKnowledgeScoped(ctxA, { tenantId: "tenant-2", query: "returns" }, deps);
    expect(searched.ok).toBe(true);
    if (searched.ok) {
      expect(searched.data.passages.map((passage) => passage.articleId)).toEqual([a1.id]);
    }

    const foreignGet = await getArticleScoped(ctxA, { id: b1.id }, deps);
    expect(foreignGet.ok).toBe(false);
    expect(foreignGet.status).toBe(404);

    const foreignWrite = await updateArticleScoped(ctxA, { id: b1.id, title: "Changed by tenant one" }, deps);
    expect(foreignWrite.ok).toBe(false);
    expect(foreignWrite.status).toBe(404);
    const bStill = await getArticle({ id: b1.id }, deps);
    if (bStill.ok) expect(bStill.data.article.title).toBe("Tenant two returns");

    const created = await createArticleScoped(
      ctxA,
      {
        tenantId: "tenant-2",
        title: "Forged tenant create",
        content: "This create attempts to forge a tenant but must use the scoped tenant."
      },
      deps
    );
    expect(created.ok).toBe(true);
    if (created.ok) expect(created.data.article.tenantId).toBe("tenant-1");

    const noScope = await listArticlesScoped(
      { orgId: "", actorId: "agent-x", roles: [] } as unknown as AuthContext,
      {},
      deps
    );
    expect(noScope.ok).toBe(false);
    expect(noScope.status).toBe(403);
  });

  it("scoped ingestion wrappers take tenant from AuthContext and hide foreign jobs/feeds", async () => {
    const store = createMemoryKnowledgeStore();
    const ctxA = authContext({ orgId: "tenant-1", actorId: "agent-a" });
    const deps = { store, now: fixedNow(T0) };

    const createdScan = await createWebScanJobScoped(
      ctxA,
      { tenantId: "tenant-2", baseUrl: "https://example.com/help" },
      deps
    );
    expect(createdScan.ok).toBe(true);
    if (createdScan.ok) expect(createdScan.data.job.tenantId).toBe("tenant-1");

    await createWebScanJob({ tenantId: "tenant-2", baseUrl: "https://other.example/help" }, { store, id: () => "foreign-scan", now: fixedNow(T0) });
    const foreignScanUpdate = await updateWebScanJobScoped(ctxA, { id: "foreign-scan", status: "failed" }, deps);
    expect(foreignScanUpdate.ok).toBe(false);
    expect(foreignScanUpdate.status).toBe(404);
    const listedScans = await listWebScanJobsScoped(ctxA, { tenantId: "tenant-2" }, deps);
    expect(listedScans.ok).toBe(true);
    if (listedScans.ok) expect(listedScans.data.jobs.every((job) => job.tenantId === "tenant-1")).toBe(true);

    const createdFeed = await createKnowledgeFeedScoped(
      ctxA,
      {
        tenantId: "tenant-2",
        feedType: "csv_url",
        name: "Scoped feed",
        sourceUrl: "https://example.com/feed.csv"
      },
      deps
    );
    expect(createdFeed.ok).toBe(true);
    if (createdFeed.ok) expect(createdFeed.data.feed.tenantId).toBe("tenant-1");

    await createKnowledgeFeed(
      { tenantId: "tenant-2", feedType: "csv_url", name: "Foreign feed", sourceUrl: "https://other.example/feed.csv" },
      { store, id: () => "foreign-feed", now: fixedNow(T0) }
    );
    const foreignFeedUpdate = await updateKnowledgeFeedScoped(ctxA, { id: "foreign-feed", syncStatus: "failed" }, deps);
    expect(foreignFeedUpdate.ok).toBe(false);
    expect(foreignFeedUpdate.status).toBe(404);
    const listedFeeds = await listKnowledgeFeedsScoped(ctxA, { tenantId: "tenant-2" }, deps);
    expect(listedFeeds.ok).toBe(true);
    if (listedFeeds.ok) expect(listedFeeds.data.feeds.every((feed) => feed.tenantId === "tenant-1")).toBe(true);
  });
});

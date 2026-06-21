import { describe, expect, it } from "vitest";
import { authContext } from "@microservices-sh/connection-contract";
import {
  createExtractiveSynthesizer,
  createKnowledgeBaseRagScopedService,
  createKnowledgeBaseRagService,
  createMemoryKnowledgeStore
} from "../index";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

describe("knowledge-base-rag service facade", () => {
  it("binds raw use-cases to shared deps", async () => {
    const store = createMemoryKnowledgeStore();
    const service = createKnowledgeBaseRagService({
      store,
      synthesizer: createExtractiveSynthesizer(),
      now: fixedNow(T0),
      correlationId: "corr-service"
    });

    const created = await service.createArticle({
      tenantId: "tenant-1",
      title: "Refund policy",
      content: "Customers can request refunds within 14 days when orders are not fulfilled."
    });
    expect(created.ok).toBe(true);
    expect(created.meta.correlationId).toBe("corr-service");

    const answered = await service.answerQuestion({ tenantId: "tenant-1", query: "refunds" });
    expect(answered.ok).toBe(true);
    if (answered.ok) {
      expect(answered.data.answer.status).toBe("draft");
      expect(answered.data.answer.citations.length).toBeGreaterThan(0);
    }
  });

  it("returns an explicit config error for answer methods without a synthesizer", async () => {
    const service = createKnowledgeBaseRagService({ store: createMemoryKnowledgeStore() });
    const answered = await service.answerQuestion({ tenantId: "tenant-1", query: "refunds" });
    expect(answered.ok).toBe(false);
    expect(answered.status).toBe(500);
    if (!answered.ok) expect(answered.error.code).toBe("knowledge-base-rag.SYNTHESIZER_NOT_CONFIGURED");
  });

  it("binds scoped use-cases and sources tenant from AuthContext", async () => {
    const store = createMemoryKnowledgeStore();
    const ctxA = authContext({ orgId: "tenant-1", actorId: "agent-a" });
    const scoped = createKnowledgeBaseRagScopedService(ctxA, {
      store,
      synthesizer: createExtractiveSynthesizer(),
      now: fixedNow(T0)
    });

    const created = await scoped.createArticle({
      tenantId: "tenant-2",
      title: "Scoped article",
      content: "A scoped service must use the AuthContext tenant instead of caller tenant input."
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("create failed");
    expect(created.data.article.tenantId).toBe("tenant-1");

    const raw = createKnowledgeBaseRagService({ store, now: fixedNow(T0) });
    const foreign = await raw.createArticle({
      tenantId: "tenant-2",
      title: "Foreign article",
      content: "Foreign tenant content should be hidden from the scoped service."
    });
    expect(foreign.ok).toBe(true);
    if (!foreign.ok) throw new Error("foreign create failed");

    const listed = await scoped.listArticles({ tenantId: "tenant-2", status: "all" });
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.data.articles.map((article) => article.id)).toEqual([created.data.article.id]);

    const foreignUpdate = await scoped.updateArticle({ id: foreign.data.article.id, title: "No leak" });
    expect(foreignUpdate.ok).toBe(false);
    expect(foreignUpdate.status).toBe(404);
  });
});

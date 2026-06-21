import { describe, expect, it } from "vitest";
import { createArticle, createMemoryKnowledgeStore, searchKnowledge, updateArticle } from "../index";
import { createEmbeddingKnowledgeSearchIndex, type VectorRecord, type VectorStore } from "./embedding-knowledge-search-index";

function fakeEmbed() {
  const texts: string[] = [];
  return {
    texts,
    embed: async (input: string[]) => {
      texts.push(...input);
      return input.map((text) => [text.length, text.includes("refund") ? 1 : 0]);
    }
  };
}

function fakeVectorStore(matches: Array<{ id: string; score?: number }> = []): VectorStore & { records: VectorRecord[]; deleted: string[]; filters: unknown[] } {
  return {
    records: [],
    deleted: [],
    filters: [],
    async upsert(records) {
      this.records.push(...records);
    },
    async deleteByIds(ids) {
      this.deleted.push(...ids);
    },
    async query(_vector, options) {
      this.filters.push(options.filter);
      return matches;
    }
  };
}

describe("createEmbeddingKnowledgeSearchIndex", () => {
  it("embeds active articles and writes tenant/project metadata to the vector store", async () => {
    const store = createMemoryKnowledgeStore();
    const embedder = fakeEmbed();
    const vectors = fakeVectorStore();
    const index = createEmbeddingKnowledgeSearchIndex({ embed: embedder.embed, vectorStore: vectors, store });

    const created = await createArticle(
      {
        tenantId: "tenant-1",
        projectId: "proj-1",
        title: "Refund policy",
        content: "Customers can request refunds within 14 days when orders are not fulfilled."
      },
      { store, searchIndex: index, id: () => "article-1", now: () => 0 }
    );

    expect(created.ok).toBe(true);
    expect(vectors.records).toHaveLength(1);
    expect(vectors.records[0].id).toBe("article-1");
    expect(vectors.records[0].metadata).toMatchObject({ tenantId: "tenant-1", projectId: "proj-1", status: "active" });
    expect(embedder.texts[0]).toContain("Refund policy");
  });

  it("removes archived articles from the vector store", async () => {
    const store = createMemoryKnowledgeStore();
    const embedder = fakeEmbed();
    const vectors = fakeVectorStore();
    const index = createEmbeddingKnowledgeSearchIndex({ embed: embedder.embed, vectorStore: vectors, store });

    const created = await createArticle(
      {
        tenantId: "tenant-1",
        title: "Refund policy",
        content: "Customers can request refunds within 14 days when orders are not fulfilled."
      },
      { store, searchIndex: index, id: () => "article-1", now: () => 0 }
    );
    expect(created.ok).toBe(true);

    const updated = await updateArticle({ id: "article-1", status: "archived" }, { store, searchIndex: index, now: () => 1 });
    expect(updated.ok).toBe(true);
    expect(vectors.deleted).toContain("article-1");
  });

  it("revalidates tenant, project, and active status after vector retrieval", async () => {
    const store = createMemoryKnowledgeStore();
    const embedder = fakeEmbed();
    const vectors = fakeVectorStore([
      { id: "foreign", score: 0.99 },
      { id: "archived", score: 0.98 },
      { id: "wrong-project", score: 0.97 },
      { id: "visible", score: 0.96 }
    ]);
    const index = createEmbeddingKnowledgeSearchIndex({ embed: embedder.embed, vectorStore: vectors, store });

    await createArticle(
      { tenantId: "tenant-2", title: "Foreign refund", content: "Foreign tenant refund content is not visible." },
      { store, id: () => "foreign", now: () => 0 }
    );
    await createArticle(
      { tenantId: "tenant-1", projectId: "proj-1", title: "Archived refund", content: "Archived refund content is not visible." },
      { store, id: () => "archived", now: () => 0 }
    );
    await updateArticle({ id: "archived", status: "archived" }, { store, now: () => 1 });
    await createArticle(
      { tenantId: "tenant-1", projectId: "proj-2", title: "Other project refund", content: "Other project refund content is not visible." },
      { store, id: () => "wrong-project", now: () => 0 }
    );
    await createArticle(
      { tenantId: "tenant-1", projectId: "proj-1", title: "Visible refund", content: "Visible refund content can answer support questions." },
      { store, id: () => "visible", now: () => 0 }
    );

    const searched = await searchKnowledge(
      { tenantId: "tenant-1", projectId: "proj-1", query: "refund", limit: 2 },
      { store, searchIndex: index }
    );

    expect(searched.ok).toBe(true);
    if (searched.ok) expect(searched.data.passages.map((passage) => passage.articleId)).toEqual(["visible"]);
    expect(vectors.filters[0]).toMatchObject({ tenantId: "tenant-1", projectId: "proj-1", status: "active" });
  });
});

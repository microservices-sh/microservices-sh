import { describe, expect, it } from "vitest";
import { createVectorizeStore, type VectorizeBinding } from "./vectorize-store";

function fakeVectorize(): VectorizeBinding & { upserts: unknown[]; deletes: string[][]; queries: unknown[] } {
  return {
    upserts: [],
    deletes: [],
    queries: [],
    async upsert(vectors) {
      this.upserts.push(vectors);
    },
    async deleteByIds(ids) {
      this.deletes.push(ids);
    },
    async query(_vector, options) {
      this.queries.push(options);
      return { matches: [{ id: "article-1", score: 0.91, metadata: { tenantId: "tenant-1" } }] };
    }
  };
}

describe("createVectorizeStore", () => {
  it("upserts vectors in Vectorize shape with sanitized metadata", async () => {
    const binding = fakeVectorize();
    const store = createVectorizeStore(binding);

    await store.upsert([
      {
        id: "article-1",
        values: [0.1, 0.2],
        metadata: {
          tenantId: "tenant-1",
          projectId: "__none__",
          status: "active",
          ignoredObject: { nested: true },
          "bad.key": "ignored",
          "$bad": "ignored"
        }
      }
    ]);

    expect(binding.upserts).toHaveLength(1);
    expect(binding.upserts[0]).toEqual([
      {
        id: "article-1",
        values: [0.1, 0.2],
        metadata: { tenantId: "tenant-1", projectId: "__none__", status: "active" }
      }
    ]);
  });

  it("batches upserts and deletes at the Workers Vectorize limit", async () => {
    const binding = fakeVectorize();
    const store = createVectorizeStore(binding);
    const records = Array.from({ length: 1001 }, (_, i) => ({ id: `a-${i}`, values: [i] }));
    await store.upsert(records);
    expect(binding.upserts).toHaveLength(2);

    await store.deleteByIds(records.map((record) => record.id));
    expect(binding.deletes).toHaveLength(2);
    expect(binding.deletes[0]).toHaveLength(1000);
    expect(binding.deletes[1]).toHaveLength(1);
  });

  it("queries with indexed metadata, no values, bounded topK, and maps matches", async () => {
    const binding = fakeVectorize();
    const store = createVectorizeStore(binding);
    const matches = await store.query([0.1, 0.2], { topK: 150, filter: { tenantId: "tenant-1", status: "active" } });

    expect(binding.queries[0]).toEqual({
      topK: 100,
      returnMetadata: "indexed",
      returnValues: false,
      filter: { tenantId: "tenant-1", status: "active" }
    });
    expect(matches).toEqual([{ id: "article-1", score: 0.91, metadata: { tenantId: "tenant-1" } }]);
  });
});

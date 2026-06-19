import { describe, expect, it } from "vitest";
import {
  createMemoryResearchStore,
  createMemoryVectorStore,
  getBrief,
  ingestSource,
  listSources,
  research
} from "./index";

const T0 = Date.parse("2026-06-19T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

const owner = { id: "user_1", scopes: ["research.read", "research.write"] };
const stranger = { id: "user_2", scopes: ["research.read", "research.write"] };

// Deterministic fake embedder: "margin" topic -> [1,0], everything else -> [0,1].
const fakeEmbedder = {
  async embed(text: string): Promise<number[]> {
    return text.toLowerCase().includes("margin") ? [1, 0] : [0, 1];
  }
};

type ResultLike = { ok: true; status: number; data: unknown } | { ok: false; status: number; error: unknown };
function okData<R extends ResultLike>(result: R): Extract<R, { ok: true }>["data"] {
  if (!result.ok) throw new Error(`expected ok result, got ${JSON.stringify(result.error)}`);
  return result.data as Extract<R, { ok: true }>["data"];
}
function code(result: ResultLike): string {
  if (result.ok) throw new Error("expected error result");
  return (result.error as { code: string }).code;
}

describe("research: ingestSource", () => {
  it("stores a source owned by the actor, embeds its chunks, and emits an event", async () => {
    const store = createMemoryResearchStore();
    const vectorStore = createMemoryVectorStore();

    const result = await ingestSource(
      { title: "Margin report", uri: "doc://margins", content: "Gross margin fell 8% YoY." },
      { store, vectorStore, embedder: fakeEmbedder, now: fixedNow(T0), actor: owner }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    const source = (okData(result) as { source: any }).source;
    expect(source.ownerId).toBe("user_1");
    expect(source.chunkCount).toBeGreaterThanOrEqual(1);

    expect(vectorStore.listRecords()).toHaveLength(source.chunkCount);
    expect(vectorStore.listRecords()[0].ownerId).toBe("user_1");

    const events = store.listEvents();
    expect(events.map((e) => e.eventName)).toEqual(["research.source_ingested"]);
  });
});

// Synthesizer that grounds itself: it only cites sources it was actually given.
const citingSynth = {
  async synthesize({ passages }: { passages: Array<{ sourceId: string }> }) {
    return { answer: "Costs rose faster than revenue.", citedSourceIds: passages.slice(0, 1).map((p) => p.sourceId) };
  }
};

async function ingestMargin(store: any, vectorStore: any, actor = owner) {
  const result = await ingestSource(
    { title: "Margin report", uri: "doc://margins", content: "Gross margin fell 8% YoY." },
    { store, vectorStore, embedder: fakeEmbedder, now: fixedNow(T0), actor }
  );
  return (okData(result) as { source: any }).source;
}

describe("research: research()", () => {
  it("returns a cited brief grounded in the actor's own sources", async () => {
    const store = createMemoryResearchStore();
    const vectorStore = createMemoryVectorStore();
    const source = await ingestMargin(store, vectorStore);

    const result = await research(
      { question: "Why did margins fall?" },
      { store, vectorStore, embedder: fakeEmbedder, synthesizer: citingSynth, now: fixedNow(T0 + 1000), actor: owner }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    const brief = (okData(result) as { brief: any }).brief;
    expect(brief.ownerId).toBe("user_1");
    expect(brief.answer).toBe("Costs rose faster than revenue.");
    expect(brief.citations.map((c: any) => c.sourceId)).toEqual([source.id]);
    expect(store.listEvents().map((e: any) => e.eventName)).toContain("research.brief_created");
  });

  it("refuses (422) when no sources ground the question", async () => {
    const store = createMemoryResearchStore();
    const vectorStore = createMemoryVectorStore();
    // nothing ingested -> no passages
    const result = await research(
      { question: "Why did margins fall?" },
      { store, vectorStore, embedder: fakeEmbedder, synthesizer: citingSynth, now: fixedNow(T0), actor: owner }
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(422);
    expect(code(result)).toBe("RESEARCH_NO_SOURCES");
  });

  it("refuses (422) when the synthesizer cites a source it was not given", async () => {
    const store = createMemoryResearchStore();
    const vectorStore = createMemoryVectorStore();
    await ingestMargin(store, vectorStore);
    const hallucinatingSynth = {
      async synthesize() {
        return { answer: "Trust me.", citedSourceIds: ["src_hallucinated"] };
      }
    };
    const result = await research(
      { question: "Why did margins fall?" },
      { store, vectorStore, embedder: fakeEmbedder, synthesizer: hallucinatingSynth, now: fixedNow(T0), actor: owner }
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(422);
    expect(code(result)).toBe("RESEARCH_UNCITED");
  });

  it("does not retrieve another owner's sources", async () => {
    const store = createMemoryResearchStore();
    const vectorStore = createMemoryVectorStore();
    await ingestMargin(store, vectorStore, owner); // owned by user_1
    const result = await research(
      { question: "Why did margins fall?" },
      { store, vectorStore, embedder: fakeEmbedder, synthesizer: citingSynth, now: fixedNow(T0), actor: stranger }
    );
    expect(result.ok).toBe(false);
    expect(code(result)).toBe("RESEARCH_NO_SOURCES");
  });
});

describe("research: governance (regression for the built-in security model)", () => {
  const ingestDeps = (store: any, vectorStore: any, actor: any) => ({
    store,
    vectorStore,
    embedder: fakeEmbedder,
    now: fixedNow(T0),
    actor
  });
  const goodInput = { title: "t", uri: "u", content: "Gross margin fell." };

  it("ingest fails closed (401) with no actor", async () => {
    const result = await ingestSource(goodInput, ingestDeps(createMemoryResearchStore(), createMemoryVectorStore(), undefined) as any);
    expect(result.status).toBe(401);
  });

  it("ingest forbids actors without research.write (403)", async () => {
    const result = await ingestSource(goodInput, ingestDeps(createMemoryResearchStore(), createMemoryVectorStore(), { id: "u", scopes: ["research.read"] }));
    expect(result.status).toBe(403);
  });

  it("ingest rejects empty content (400)", async () => {
    const result = await ingestSource({ title: "t", uri: "u", content: "" }, ingestDeps(createMemoryResearchStore(), createMemoryVectorStore(), owner));
    expect(result.status).toBe(400);
    expect(code(result)).toBe("INVALID_RESEARCH_INPUT");
  });

  it("research fails closed (401) with no actor", async () => {
    const result = await research(
      { question: "q" },
      { store: createMemoryResearchStore(), vectorStore: createMemoryVectorStore(), embedder: fakeEmbedder, synthesizer: citingSynth, now: fixedNow(T0) } as any
    );
    expect(result.status).toBe(401);
  });

  it("research forbids actors without research.read (403)", async () => {
    const result = await research(
      { question: "q" },
      { store: createMemoryResearchStore(), vectorStore: createMemoryVectorStore(), embedder: fakeEmbedder, synthesizer: citingSynth, now: fixedNow(T0), actor: { id: "u", scopes: [] } }
    );
    expect(result.status).toBe(403);
  });

  it("writes audit entries on ingest and on research", async () => {
    const store = createMemoryResearchStore();
    const vectorStore = createMemoryVectorStore();
    const audits: any[] = [];
    const audit = { async record(e: any) { audits.push(e); } };
    await ingestSource({ title: "Margin report", uri: "doc://m", content: "Gross margin fell 8%." }, { store, vectorStore, embedder: fakeEmbedder, now: fixedNow(T0), actor: owner, audit });
    await research({ question: "Why did margins fall?" }, { store, vectorStore, embedder: fakeEmbedder, synthesizer: citingSynth, now: fixedNow(T0 + 1), actor: owner, audit });
    expect(audits.map((a) => a.action)).toEqual(["research.source_ingested", "research.brief_created"]);
    expect(audits.every((a) => a.actorId === "user_1")).toBe(true);
  });
});

describe("research: getBrief / listSources ownership", () => {
  it("getBrief hides another owner's brief (404) and lets the owner read it", async () => {
    const store = createMemoryResearchStore();
    const vectorStore = createMemoryVectorStore();
    await ingestMargin(store, vectorStore, owner);
    const brief = (okData(await research({ question: "Why did margins fall?" }, { store, vectorStore, embedder: fakeEmbedder, synthesizer: citingSynth, now: fixedNow(T0 + 1), actor: owner })) as { brief: any }).brief;

    expect((await getBrief({ briefId: brief.id }, { store, actor: stranger })).status).toBe(404);
    const ownerView = await getBrief({ briefId: brief.id }, { store, actor: owner });
    expect(ownerView.ok).toBe(true);
  });

  it("listSources returns only the actor's own sources", async () => {
    const store = createMemoryResearchStore();
    const vectorStore = createMemoryVectorStore();
    await ingestMargin(store, vectorStore, owner);
    const mine = okData(await listSources({ store, actor: owner })) as { sources: any[] };
    const theirs = okData(await listSources({ store, actor: stranger })) as { sources: any[] };
    expect(mine.sources).toHaveLength(1);
    expect(theirs.sources).toHaveLength(0);
  });
});

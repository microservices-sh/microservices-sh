import { describe, expect, it } from "vitest";
import {
  createGraphRetriever,
  createMemoryGraphStore,
  createMemoryResearchStore,
  getBrief,
  loadGraphifyOutput,
  research
} from "./index";

const T0 = Date.parse("2026-06-19T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

const owner = { id: "user_1", scopes: ["research.read"] };
const stranger = { id: "user_2", scopes: ["research.read"] };

type ResultLike = { ok: true; status: number; data: unknown } | { ok: false; status: number; error: unknown };
function okData<R extends ResultLike>(r: R): Extract<R, { ok: true }>["data"] {
  if (!r.ok) throw new Error(`expected ok result, got ${JSON.stringify(r.error)}`);
  return r.data as Extract<R, { ok: true }>["data"];
}
function code(r: ResultLike): string {
  if (r.ok) throw new Error("expected error result");
  return (r.error as { code: string }).code;
}

const graphifyOutput = {
  semantic: {
    nodes: [
      { id: "margins_doc", label: "Margin report", file_type: "document", source_file: "docs/margins.md", source_location: "L1" },
      { id: "pricing", label: "Pricing policy", file_type: "document", source_file: "docs/pricing.md", source_location: "L10" },
      { id: "snacks", label: "Office snacks", file_type: "document", source_file: "docs/office.md", source_location: "L3" }
    ],
    edges: [{ source: "margins_doc", target: "pricing", relation: "references", weight: 1.0 }]
  },
  analysis: { communities: { "0": ["margins_doc", "pricing"], "1": ["snacks"] }, cohesion: { "0": 0.8, "1": 0.1 } },
  labels: { "0": "Finance", "1": "Facilities" }
};

// Grounded synthesizer: only cites sources it was actually given.
const citingSynth = {
  async synthesize({ passages }: { passages: Array<{ sourceFile: string }> }) {
    return { answer: "Costs rose faster than revenue.", citedSourceFiles: passages.slice(0, 1).map((p) => p.sourceFile) };
  }
};

async function retrieverFor(ownerId = owner.id) {
  const graph = createMemoryGraphStore();
  await loadGraphifyOutput(graphifyOutput, { store: graph, ownerId });
  return createGraphRetriever(graph);
}

describe("research: research() over the knowledge graph", () => {
  it("returns a cited brief grounded in the owner's graph", async () => {
    const store = createMemoryResearchStore();
    const retriever = await retrieverFor();

    const result = await research(
      { question: "Why did margin fall?" },
      { store, retriever, synthesizer: citingSynth, now: fixedNow(T0), actor: owner }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    const brief = (okData(result) as { brief: any }).brief;
    expect(brief.ownerId).toBe("user_1");
    expect(brief.answer).toBe("Costs rose faster than revenue.");
    expect(brief.citations[0].sourceFile).toBe("docs/margins.md");
    expect(store.listEvents().map((e: any) => e.eventName)).toContain("research.brief_created");
  });

  it("refuses (422) when no sources ground the question", async () => {
    const store = createMemoryResearchStore();
    const retriever = await retrieverFor();
    const result = await research(
      { question: "quarterly zzzzz nonsense" },
      { store, retriever, synthesizer: citingSynth, now: fixedNow(T0), actor: owner }
    );
    expect(result.status).toBe(422);
    expect(code(result)).toBe("RESEARCH_NO_SOURCES");
  });

  it("refuses (422) when the synthesizer cites a source it was not given", async () => {
    const store = createMemoryResearchStore();
    const retriever = await retrieverFor();
    const hallucinating = {
      async synthesize() {
        return { answer: "Trust me.", citedSourceFiles: ["docs/made-up.md"] };
      }
    };
    const result = await research(
      { question: "Why did margin fall?" },
      { store, retriever, synthesizer: hallucinating, now: fixedNow(T0), actor: owner }
    );
    expect(result.status).toBe(422);
    expect(code(result)).toBe("RESEARCH_UNCITED");
  });

  it("does not retrieve another owner's graph", async () => {
    const store = createMemoryResearchStore();
    const retriever = await retrieverFor(owner.id); // graph owned by user_1
    const result = await research(
      { question: "Why did margin fall?" },
      { store, retriever, synthesizer: citingSynth, now: fixedNow(T0), actor: stranger }
    );
    expect(code(result)).toBe("RESEARCH_NO_SOURCES");
  });
});

describe("research: governance", () => {
  it("fails closed (401) with no actor", async () => {
    const result = await research(
      { question: "q" },
      { store: createMemoryResearchStore(), retriever: await retrieverFor(), synthesizer: citingSynth, now: fixedNow(T0) } as any
    );
    expect(result.status).toBe(401);
  });

  it("forbids actors without research.read (403)", async () => {
    const result = await research(
      { question: "q" },
      { store: createMemoryResearchStore(), retriever: await retrieverFor(), synthesizer: citingSynth, now: fixedNow(T0), actor: { id: "u", scopes: [] } }
    );
    expect(result.status).toBe(403);
  });

  it("rejects empty input (400)", async () => {
    const result = await research(
      { question: "" },
      { store: createMemoryResearchStore(), retriever: await retrieverFor(), synthesizer: citingSynth, now: fixedNow(T0), actor: owner }
    );
    expect(result.status).toBe(400);
    expect(code(result)).toBe("INVALID_RESEARCH_INPUT");
  });

  it("writes an audit entry on a successful brief", async () => {
    const store = createMemoryResearchStore();
    const audits: any[] = [];
    const audit = { async record(e: any) { audits.push(e); } };
    await research(
      { question: "Why did margin fall?" },
      { store, retriever: await retrieverFor(), synthesizer: citingSynth, now: fixedNow(T0), actor: owner, audit }
    );
    expect(audits.map((a) => a.action)).toEqual(["research.brief_created"]);
    expect(audits[0].actorId).toBe("user_1");
  });
});

describe("research: getBrief ownership", () => {
  it("hides another owner's brief (404) and lets the owner read it", async () => {
    const store = createMemoryResearchStore();
    const brief = (okData(
      await research({ question: "Why did margin fall?" }, { store, retriever: await retrieverFor(), synthesizer: citingSynth, now: fixedNow(T0), actor: owner })
    ) as { brief: any }).brief;

    expect((await getBrief({ briefId: brief.id }, { store, actor: stranger })).status).toBe(404);
    expect((await getBrief({ briefId: brief.id }, { store, actor: owner })).ok).toBe(true);
  });
});

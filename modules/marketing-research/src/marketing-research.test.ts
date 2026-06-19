import { describe, expect, it } from "vitest";
import {
  createMemoryMarketingStore,
  getBrief,
  runResearch,
  type Signal,
  type SocialListenPort,
  type Synthesizer
} from "./index";

const T0 = Date.parse("2026-06-19T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

const owner = { id: "user_1", scopes: ["marketing.run", "marketing.read"] };
const stranger = { id: "user_2", scopes: ["marketing.read"] };
const admin = { id: "user_9", scopes: ["marketing.read", "marketing.admin"] };

type ResultLike = { ok: true; status: number; data: unknown } | { ok: false; status: number; error: unknown };
function okData<R extends ResultLike>(r: R): Extract<R, { ok: true }>["data"] {
  if (!r.ok) throw new Error(`expected ok result, got ${JSON.stringify(r.error)}`);
  return r.data as Extract<R, { ok: true }>["data"];
}
function code(r: ResultLike): string {
  if (r.ok) throw new Error("expected error result");
  return (r.error as { code: string }).code;
}

const SIGNALS: Signal[] = [
  { source: "reddit", sourceUrl: "https://reddit.com/r/CloudFlare/1", title: "Multi-tenant RBAC by hand", excerpt: "porting RBAC...", engagement: 40 },
  { source: "reddit", sourceUrl: "https://reddit.com/r/Supabase/2", title: "protect from day 0", excerpt: "RLS / data exposure", engagement: 31 }
];
const COVERAGE = { searched: ["reddit", "hackernews"], returned: ["reddit"], note: "HN returned 0" };

// Listens that return fixed evidence (real adapter wraps /last30days).
const listenWith = (signals: Signal[]): SocialListenPort => ({
  async listen() {
    return { signals, coverage: COVERAGE };
  }
});

// Grounded synthesizer: cites only the URLs it was given.
const groundedSynth: Synthesizer = {
  async synthesize({ signals }) {
    return {
      summary: "Builders hand-roll the 30%; data exposure is a live fear.",
      implications: ["Lead with fails-closed", "Enter via r/CloudFlare + r/Supabase"],
      citedSourceUrls: signals.map((s) => s.sourceUrl)
    };
  }
};

// Hallucinating synthesizer: cites a URL that was never a signal.
const hallucinatingSynth: Synthesizer = {
  async synthesize() {
    return { summary: "Demand is huge.", implications: ["ship it"], citedSourceUrls: ["https://made-up.example/leak"] };
  }
};

function deps(over: Partial<Parameters<typeof runResearch>[1]> = {}) {
  return {
    store: createMemoryMarketingStore(),
    listen: listenWith(SIGNALS),
    synthesizer: groundedSynth,
    now: fixedNow(T0),
    actor: owner,
    ...over
  } as Parameters<typeof runResearch>[1];
}

describe("runResearch", () => {
  it("produces a cited brief from grounded signals and emits an event", async () => {
    const d = deps();
    const res = await runResearch({ topic: "agentic coding" }, d);
    const { brief } = okData(res) as { brief: any };

    expect(res.status).toBe(201);
    expect(brief.topic).toBe("agentic coding");
    expect(brief.implications).toHaveLength(2);
    expect(brief.citations.map((c: any) => c.sourceUrl)).toEqual(SIGNALS.map((s) => s.sourceUrl));
    expect(brief.citations[0].title).toBe("Multi-tenant RBAC by hand");
    expect(brief.ownerId).toBe("user_1");

    const events = (d.store as any).listEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe("marketing.brief_created");
  });

  it("records honest coverage (searched vs returned)", async () => {
    const res = await runResearch({ topic: "vibe coding" }, deps());
    const { brief } = okData(res) as { brief: any };
    expect(brief.coverage).toEqual(COVERAGE);
  });

  it("refuses when no grounded signals exist (cite-or-refuse)", async () => {
    const res = await runResearch({ topic: "obscure" }, deps({ listen: listenWith([]) }));
    expect(res.status).toBe(422);
    expect(code(res)).toBe("MARKETING_NO_SIGNALS");
  });

  it("refuses synthesis that cites a source it was not given (hallucination guard)", async () => {
    const res = await runResearch({ topic: "agentic coding" }, deps({ synthesizer: hallucinatingSynth }));
    expect(res.status).toBe(422);
    expect(code(res)).toBe("MARKETING_UNCITED");
  });

  it("fails closed: no actor -> 401, missing scope -> 403", async () => {
    const noActor = await runResearch({ topic: "x" }, deps({ actor: null as any }));
    expect(noActor.status).toBe(401);
    const wrongScope = await runResearch({ topic: "x" }, deps({ actor: stranger }));
    expect(wrongScope.status).toBe(403);
    expect(code(wrongScope)).toBe("FORBIDDEN");
  });

  it("rejects invalid input (empty topic) -> 400", async () => {
    const res = await runResearch({ topic: "" }, deps());
    expect(res.status).toBe(400);
    expect(code(res)).toBe("INVALID_MARKETING_INPUT");
  });
});

describe("getBrief", () => {
  async function seed() {
    const store = createMemoryMarketingStore();
    const res = await runResearch({ topic: "agentic coding" }, deps({ store }));
    const { brief } = okData(res) as { brief: any };
    return { store, briefId: brief.id as string };
  }

  it("returns the brief to its owner", async () => {
    const { store, briefId } = await seed();
    const res = await getBrief({ briefId }, { store, actor: owner });
    expect(res.status).toBe(200);
  });

  it("returns 404 (not 403) to a stranger — no existence oracle", async () => {
    const { store, briefId } = await seed();
    const res = await getBrief({ briefId }, { store, actor: stranger });
    expect(res.status).toBe(404);
    expect(code(res)).toBe("MARKETING_NOT_FOUND");
  });

  it("lets an admin read any brief", async () => {
    const { store, briefId } = await seed();
    const res = await getBrief({ briefId }, { store, actor: admin });
    expect(res.status).toBe(200);
  });
});

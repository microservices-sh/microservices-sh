import { describe, expect, it } from "vitest";
import { createMemoryDecisionStore, draftDecisionFromResearch } from "./index";

const T0 = Date.parse("2026-06-19T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;
const owner = { id: "user_1", scopes: ["decision.write"] };

type ResultLike = { ok: true; status: number; data: unknown } | { ok: false; status: number; error: unknown };
function okData<R extends ResultLike>(r: R): Extract<R, { ok: true }>["data"] {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data as Extract<R, { ok: true }>["data"];
}
function code(r: ResultLike): string {
  if (r.ok) throw new Error("expected error");
  return (r.error as { code: string }).code;
}

// Proposer that grounds itself in whatever sources it is given.
const groundedProposer = {
  async propose(input: { sources: { id: string }[] }) {
    return {
      options: [{ id: "a", summary: "Adopt the price increase" }],
      risks: [{ summary: "Churn", severity: "medium" as const }],
      assumptions: [],
      recommendation: { summary: "Adopt", optionId: "a", sourceIds: input.sources.map((s) => s.id) }
    };
  }
};

const researchBrief = {
  id: "rsb_abc",
  question: "Why did margins fall?",
  answer: "Costs rose faster than revenue across Q2.",
  citations: [{ sourceFile: "docs/margins.md" }, { sourceFile: "docs/pricing.md" }]
};

describe("decision: draftDecisionFromResearch", () => {
  it("grounds a decision in a research brief — context from the answer, sources from the citations", async () => {
    const store = createMemoryDecisionStore();
    const result = await draftDecisionFromResearch(
      { research: researchBrief },
      { store, proposer: groundedProposer, now: fixedNow(T0), actor: owner }
    );

    expect(result.ok).toBe(true);
    const brief = (okData(result) as { brief: any }).brief;
    expect(brief.context).toBe("Costs rose faster than revenue across Q2.");
    expect(brief.sources.map((s: any) => s.title)).toEqual(["docs/margins.md", "docs/pricing.md"]);
    // recommendation cites the research-derived sources, so cite-or-refuse passes
    expect(brief.recommendation.sourceIds.length).toBe(2);
    expect(brief.ownerId).toBe("user_1");
    // question references the research question when none is supplied
    expect(brief.question).toContain("Why did margins fall?");
  });

  it("uses an explicit decision question when supplied", async () => {
    const store = createMemoryDecisionStore();
    const result = await draftDecisionFromResearch(
      { research: researchBrief, question: "Should we raise prices 8%?" },
      { store, proposer: groundedProposer, now: fixedNow(T0), actor: owner }
    );
    const brief = (okData(result) as { brief: any }).brief;
    expect(brief.question).toBe("Should we raise prices 8%?");
  });

  it("refuses (422) when the research brief has no citations to ground on", async () => {
    const store = createMemoryDecisionStore();
    const uncited = { ...researchBrief, citations: [] as { sourceFile: string }[] };
    const result = await draftDecisionFromResearch(
      { research: uncited },
      { store, proposer: groundedProposer, now: fixedNow(T0), actor: owner }
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(422);
    expect(code(result)).toBe("DECISION_UNCITED");
  });
});

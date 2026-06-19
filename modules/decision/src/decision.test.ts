import { describe, expect, it } from "vitest";
import { createMemoryDecisionStore, draftDecisionBrief, listDecisions, recordDecision } from "./index";

const T0 = Date.parse("2026-06-19T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

type ResultLike = { ok: true; status: number; data: unknown } | { ok: false; status: number; error: unknown };

function okData<R extends ResultLike>(result: R): Extract<R, { ok: true }>["data"] {
  if (!result.ok) throw new Error(`expected ok result, got ${JSON.stringify(result.error)}`);
  return result.data as Extract<R, { ok: true }>["data"];
}

// Injected advisory proposer (stands in for the LLM draft). The use-case must
// never let a proposal auto-decide — a human records the decision separately.
const citedProposer = {
  async propose() {
    return {
      options: [
        { id: "a", summary: "Raise prices 8%" },
        { id: "b", summary: "Hold prices" }
      ],
      risks: [{ summary: "Churn risk on price-sensitive tier", severity: "medium" as const }],
      assumptions: ["Demand is inelastic below 10%"],
      recommendation: { summary: "Raise prices 8%", optionId: "a", sourceIds: ["s1"] }
    };
  }
};

describe("decision: draftDecisionBrief", () => {
  it("produces a DRAFT brief (never auto-decided) from a cited proposal", async () => {
    const store = createMemoryDecisionStore();

    const result = await draftDecisionBrief(
      {
        question: "Should we raise prices?",
        context: "Gross margin compressed 8% YoY.",
        sources: [{ id: "s1", title: "Margin report", uri: "doc://margins" }],
        ownerId: "user_1"
      },
      { store, proposer: citedProposer, now: fixedNow(T0) }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);

    const brief = (okData(result) as { brief: any }).brief;
    expect(brief.status).toBe("draft");
    expect(brief.recommendation.summary).toBe("Raise prices 8%");
    expect(brief.ownerId).toBe("user_1");
  });

  it("refuses a recommendation that cites a source not in the provided set (cite-or-refuse)", async () => {
    const store = createMemoryDecisionStore();
    const uncitedProposer = {
      async propose() {
        return {
          options: [{ id: "a", summary: "Raise prices 8%" }],
          risks: [],
          assumptions: [],
          // cites s9, which was never provided as a source
          recommendation: { summary: "Raise prices 8%", optionId: "a", sourceIds: ["s9"] }
        };
      }
    };

    const result = await draftDecisionBrief(
      {
        question: "Should we raise prices?",
        context: "Gross margin compressed 8% YoY.",
        sources: [{ id: "s1", title: "Margin report", uri: "doc://margins" }],
        ownerId: "user_1"
      },
      { store, proposer: uncitedProposer, now: fixedNow(T0) }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(422);
    expect((result as { error: { code: string } }).error.code).toBe("DECISION_UNCITED");
  });

  it("refuses a recommendation with no citations at all", async () => {
    const store = createMemoryDecisionStore();
    const noCiteProposer = {
      async propose() {
        return {
          options: [{ id: "a", summary: "Raise prices 8%" }],
          risks: [],
          assumptions: [],
          recommendation: { summary: "Raise prices 8%", optionId: "a", sourceIds: [] }
        };
      }
    };

    const result = await draftDecisionBrief(
      {
        question: "Should we raise prices?",
        context: "Margins down.",
        sources: [{ id: "s1", title: "Margin report", uri: "doc://margins" }],
        ownerId: "user_1"
      },
      { store, proposer: noCiteProposer, now: fixedNow(T0) }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(422);
    expect((result as { error: { code: string } }).error.code).toBe("DECISION_UNCITED");
  });

  it("rejects input with no question", async () => {
    const store = createMemoryDecisionStore();
    const result = await draftDecisionBrief(
      { question: "", context: "ctx", sources: [{ id: "s1", title: "t", uri: "u" }], ownerId: "user_1" },
      { store, proposer: citedProposer, now: fixedNow(T0) }
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect((result as { error: { code: string } }).error.code).toBe("INVALID_DECISION_INPUT");
  });

  it("emits a decision.brief_drafted event on a successful draft", async () => {
    const store = createMemoryDecisionStore();
    const result = await draftDecisionBrief(
      {
        question: "Should we raise prices?",
        context: "Margins down.",
        sources: [{ id: "s1", title: "Margin report", uri: "doc://margins" }],
        ownerId: "user_1"
      },
      { store, proposer: citedProposer, now: fixedNow(T0) }
    );
    const brief = (okData(result) as { brief: any }).brief;
    const events = store.listEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe("decision.brief_drafted");
    expect(events[0].entityId).toBe(brief.id);
  });
});

async function draftStoredBrief(store: ReturnType<typeof createMemoryDecisionStore>) {
  const result = await draftDecisionBrief(
    {
      question: "Should we raise prices?",
      context: "Margins down.",
      sources: [{ id: "s1", title: "Margin report", uri: "doc://margins" }],
      ownerId: "user_1"
    },
    { store, proposer: citedProposer, now: fixedNow(T0) }
  );
  return (okData(result) as { brief: any }).brief;
}

describe("decision: recordDecision", () => {
  it("accepting a brief sets status 'accepted' and appends a decision-log entry", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store);

    const result = await recordDecision(
      { briefId: brief.id, choice: "accept", rationale: "Margins justify it", ownerId: "user_1" },
      { store, now: fixedNow(T0 + 1000) }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    const data = okData(result) as { log: any; brief: any };
    expect(data.log.choice).toBe("accept");
    expect(data.brief.status).toBe("accepted");
  });

  it("keeps an append-only history when a brief is decided more than once", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store);

    await recordDecision(
      { briefId: brief.id, choice: "defer", rationale: "Need more data", ownerId: "user_1" },
      { store, now: fixedNow(T0 + 1000) }
    );
    await recordDecision(
      { briefId: brief.id, choice: "accept", rationale: "Data arrived", ownerId: "user_1" },
      { store, now: fixedNow(T0 + 2000) }
    );

    const history = okData(await listDecisions({ briefId: brief.id }, { store })) as { logs: any[] };
    expect(history.logs).toHaveLength(2);
    expect(history.logs.map((l) => l.choice)).toEqual(["defer", "accept"]);
  });

  it("rejecting a brief sets status 'rejected' and produces no action request", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store);

    const result = await recordDecision(
      { briefId: brief.id, choice: "reject", rationale: "Too risky", ownerId: "user_1" },
      { store, now: fixedNow(T0 + 1000) }
    );

    const data = okData(result) as { brief: any; actionRequest?: unknown };
    expect(data.brief.status).toBe("rejected");
    expect(data.actionRequest).toBeUndefined();
  });

  it("returns 404 for an unknown brief", async () => {
    const store = createMemoryDecisionStore();
    const result = await recordDecision(
      { briefId: "dec_missing", choice: "accept", rationale: "x", ownerId: "user_1" },
      { store, now: fixedNow(T0) }
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect((result as { error: { code: string } }).error.code).toBe("DECISION_NOT_FOUND");
  });

  it("accepting closes into action: dispatches a task carrying the recommendation", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store);

    const dispatched: any[] = [];
    const dispatcher = {
      async dispatch(req: any) {
        dispatched.push(req);
        return { taskId: "task_1" };
      }
    };

    const result = await recordDecision(
      { briefId: brief.id, choice: "accept", rationale: "Go", ownerId: "user_1" },
      { store, now: fixedNow(T0 + 1000), dispatcher }
    );

    const data = okData(result) as { actionRequest: any };
    expect(data.actionRequest.kind).toBe("task");
    expect(data.actionRequest.title).toBe(brief.recommendation.summary);
    expect(data.actionRequest.taskId).toBe("task_1");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].decisionBriefId).toBe(brief.id);
  });
});

describe("decision: governance", () => {
  it("forbids drafting when the actor lacks decision.write scope", async () => {
    const store = createMemoryDecisionStore();
    const result = await draftDecisionBrief(
      {
        question: "Should we raise prices?",
        context: "Margins down.",
        sources: [{ id: "s1", title: "Margin report", uri: "doc://margins" }],
        ownerId: "user_1"
      },
      { store, proposer: citedProposer, now: fixedNow(T0), actor: { id: "user_1", scopes: [] } }
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect((result as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("allows drafting when the actor holds decision.write scope", async () => {
    const store = createMemoryDecisionStore();
    const result = await draftDecisionBrief(
      {
        question: "Should we raise prices?",
        context: "Margins down.",
        sources: [{ id: "s1", title: "Margin report", uri: "doc://margins" }],
        ownerId: "user_1"
      },
      { store, proposer: citedProposer, now: fixedNow(T0), actor: { id: "user_1", scopes: ["decision.write"] } }
    );
    expect(result.ok).toBe(true);
  });

  it("forbids recording when the actor lacks decision.write scope", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store);
    const result = await recordDecision(
      { briefId: brief.id, choice: "accept", rationale: "Go", ownerId: "user_1" },
      { store, now: fixedNow(T0 + 1000), actor: { id: "user_1", scopes: ["decision.read"] } }
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it("writes an audit entry on draft and on record", async () => {
    const store = createMemoryDecisionStore();
    const audits: any[] = [];
    const audit = {
      async record(entry: any) {
        audits.push(entry);
      }
    };

    const drafted = await draftDecisionBrief(
      {
        question: "Should we raise prices?",
        context: "Margins down.",
        sources: [{ id: "s1", title: "Margin report", uri: "doc://margins" }],
        ownerId: "user_1"
      },
      { store, proposer: citedProposer, now: fixedNow(T0), audit }
    );
    const brief = (okData(drafted) as { brief: any }).brief;

    await recordDecision(
      { briefId: brief.id, choice: "accept", rationale: "Go", ownerId: "user_1" },
      { store, now: fixedNow(T0 + 1000), audit }
    );

    expect(audits.map((a) => a.action)).toEqual(["decision.brief_drafted", "decision.recorded"]);
    expect(audits[0].entityId).toBe(brief.id);
  });
});

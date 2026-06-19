import { describe, expect, it } from "vitest";
import { createMemoryDecisionStore, draftDecisionBrief, listDecisions, recordDecision } from "./index";

const T0 = Date.parse("2026-06-19T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

const owner = { id: "user_1", scopes: ["decision.read", "decision.write"] };
const ownerReadOnly = { id: "user_1", scopes: ["decision.read"] };
const ownerNoScopes = { id: "user_1", scopes: [] };
const stranger = { id: "user_2", scopes: ["decision.read", "decision.write"] };
const admin = { id: "admin_1", scopes: ["decision.read", "decision.write", "decision.admin"] };

type ResultLike = { ok: true; status: number; data: unknown } | { ok: false; status: number; error: unknown };

function okData<R extends ResultLike>(result: R): Extract<R, { ok: true }>["data"] {
  if (!result.ok) throw new Error(`expected ok result, got ${JSON.stringify(result.error)}`);
  return result.data as Extract<R, { ok: true }>["data"];
}

function code(result: ResultLike): string {
  if (result.ok) throw new Error("expected error result");
  return (result.error as { code: string }).code;
}

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

const baseDraftInput = {
  question: "Should we raise prices?",
  context: "Gross margin compressed 8% YoY.",
  sources: [{ id: "s1", title: "Margin report", uri: "doc://margins" }]
};

async function draftStoredBrief(store: ReturnType<typeof createMemoryDecisionStore>, actor = owner) {
  const result = await draftDecisionBrief(baseDraftInput, { store, proposer: citedProposer, now: fixedNow(T0), actor });
  return (okData(result) as { brief: any }).brief;
}

describe("decision: draftDecisionBrief", () => {
  it("produces a DRAFT brief whose owner is derived from the actor (never the client)", async () => {
    const store = createMemoryDecisionStore();
    const result = await draftDecisionBrief(
      // a spoofed ownerId in the payload must be ignored
      { ...baseDraftInput, ownerId: "attacker" } as any,
      { store, proposer: citedProposer, now: fixedNow(T0), actor: owner }
    );
    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    const brief = (okData(result) as { brief: any }).brief;
    expect(brief.status).toBe("draft");
    expect(brief.recommendation.summary).toBe("Raise prices 8%");
    expect(brief.ownerId).toBe("user_1");
  });

  it("refuses a recommendation that cites a source not in the provided set", async () => {
    const store = createMemoryDecisionStore();
    const uncitedProposer = {
      async propose() {
        return {
          options: [{ id: "a", summary: "Raise prices 8%" }],
          risks: [],
          assumptions: [],
          recommendation: { summary: "Raise prices 8%", optionId: "a", sourceIds: ["s9"] }
        };
      }
    };
    const result = await draftDecisionBrief(baseDraftInput, { store, proposer: uncitedProposer, now: fixedNow(T0), actor: owner });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(422);
    expect(code(result)).toBe("DECISION_UNCITED");
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
    const result = await draftDecisionBrief(baseDraftInput, { store, proposer: noCiteProposer, now: fixedNow(T0), actor: owner });
    expect(result.ok).toBe(false);
    expect(code(result)).toBe("DECISION_UNCITED");
  });

  it("rejects input with no question", async () => {
    const store = createMemoryDecisionStore();
    const result = await draftDecisionBrief(
      { ...baseDraftInput, question: "" },
      { store, proposer: citedProposer, now: fixedNow(T0), actor: owner }
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(code(result)).toBe("INVALID_DECISION_INPUT");
  });

  it("emits a decision.brief_drafted event on a successful draft", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store);
    const events = store.listEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe("decision.brief_drafted");
    expect(events[0].entityId).toBe(brief.id);
  });
});

describe("decision: authorization", () => {
  it("fails closed (401) when no actor is supplied", async () => {
    const store = createMemoryDecisionStore();
    const result = await draftDecisionBrief(baseDraftInput, { store, proposer: citedProposer, now: fixedNow(T0) } as any);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(code(result)).toBe("UNAUTHENTICATED");
  });

  it("forbids drafting when the actor lacks decision.write scope", async () => {
    const store = createMemoryDecisionStore();
    const result = await draftDecisionBrief(baseDraftInput, { store, proposer: citedProposer, now: fixedNow(T0), actor: ownerNoScopes });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(code(result)).toBe("FORBIDDEN");
  });

  it("forbids recording when the actor lacks decision.write scope", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store);
    const result = await recordDecision(
      { briefId: brief.id, choice: "accept", rationale: "Go" },
      { store, now: fixedNow(T0 + 1000), actor: ownerReadOnly }
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });
});

describe("decision: recordDecision", () => {
  it("accepting a brief sets status 'accepted', appends a log, and derives ownerId from the actor", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store);
    const result = await recordDecision(
      { briefId: brief.id, choice: "accept", rationale: "Margins justify it" },
      { store, now: fixedNow(T0 + 1000), actor: owner }
    );
    expect(result.status).toBe(201);
    const data = okData(result) as { log: any; brief: any };
    expect(data.log.choice).toBe("accept");
    expect(data.log.ownerId).toBe("user_1");
    expect(data.brief.status).toBe("accepted");
  });

  it("keeps an append-only history when a brief is decided more than once", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store);
    await recordDecision({ briefId: brief.id, choice: "defer", rationale: "Need data" }, { store, now: fixedNow(T0 + 1000), actor: owner });
    await recordDecision({ briefId: brief.id, choice: "accept", rationale: "Data arrived" }, { store, now: fixedNow(T0 + 2000), actor: owner });
    const history = okData(await listDecisions({ briefId: brief.id }, { store, actor: owner })) as { logs: any[] };
    expect(history.logs.map((l) => l.choice)).toEqual(["defer", "accept"]);
  });

  it("rejecting a brief sets status 'rejected' and produces no action request", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store);
    const result = await recordDecision({ briefId: brief.id, choice: "reject", rationale: "Too risky" }, { store, now: fixedNow(T0 + 1000), actor: owner });
    const data = okData(result) as { brief: any; actionRequest?: unknown };
    expect(data.brief.status).toBe("rejected");
    expect(data.actionRequest).toBeUndefined();
  });

  it("returns 404 for an unknown brief", async () => {
    const store = createMemoryDecisionStore();
    const result = await recordDecision({ briefId: "dec_missing", choice: "accept", rationale: "x" }, { store, now: fixedNow(T0), actor: owner });
    expect(result.status).toBe(404);
    expect(code(result)).toBe("DECISION_NOT_FOUND");
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
      { briefId: brief.id, choice: "accept", rationale: "Go" },
      { store, now: fixedNow(T0 + 1000), dispatcher, actor: owner }
    );
    const data = okData(result) as { actionRequest: any };
    expect(data.actionRequest.kind).toBe("task");
    expect(data.actionRequest.title).toBe(brief.recommendation.summary);
    expect(data.actionRequest.ownerId).toBe("user_1");
    expect(data.actionRequest.taskId).toBe("task_1");
    expect(dispatched[0].decisionBriefId).toBe(brief.id);
  });
});

describe("decision: ownership (IDOR protection)", () => {
  it("hides another owner's brief from recordDecision (404, not 403)", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store, owner);
    const result = await recordDecision({ briefId: brief.id, choice: "accept", rationale: "mine now" }, { store, now: fixedNow(T0 + 1000), actor: stranger });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(code(result)).toBe("DECISION_NOT_FOUND");
  });

  it("lets an actor with decision.admin record on another owner's brief", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store, owner);
    const result = await recordDecision({ briefId: brief.id, choice: "accept", rationale: "override" }, { store, now: fixedNow(T0 + 1000), actor: admin });
    expect(result.ok).toBe(true);
    const data = okData(result) as { log: any };
    expect(data.log.ownerId).toBe("admin_1");
  });
});

describe("decision: listDecisions", () => {
  it("requires authentication (401)", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store);
    const result = await listDecisions({ briefId: brief.id }, { store } as any);
    expect(result.status).toBe(401);
  });

  it("forbids actors without decision.read scope (403)", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store);
    const result = await listDecisions({ briefId: brief.id }, { store, actor: { id: "user_1", scopes: [] } });
    expect(result.status).toBe(403);
  });

  it("hides another owner's decision history (404)", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store, owner);
    const result = await listDecisions({ briefId: brief.id }, { store, actor: stranger });
    expect(result.status).toBe(404);
  });

  it("lets the owner read their own decision history", async () => {
    const store = createMemoryDecisionStore();
    const brief = await draftStoredBrief(store, owner);
    await recordDecision({ briefId: brief.id, choice: "accept", rationale: "Go" }, { store, now: fixedNow(T0 + 1000), actor: owner });
    const result = await listDecisions({ briefId: brief.id }, { store, actor: owner });
    expect(result.ok).toBe(true);
    expect((okData(result) as { logs: any[] }).logs).toHaveLength(1);
  });
});

describe("decision: audit", () => {
  it("writes an audit entry on draft and on record", async () => {
    const store = createMemoryDecisionStore();
    const audits: any[] = [];
    const audit = {
      async record(entry: any) {
        audits.push(entry);
      }
    };
    const drafted = await draftDecisionBrief(baseDraftInput, { store, proposer: citedProposer, now: fixedNow(T0), actor: owner, audit });
    const brief = (okData(drafted) as { brief: any }).brief;
    await recordDecision({ briefId: brief.id, choice: "accept", rationale: "Go" }, { store, now: fixedNow(T0 + 1000), actor: owner, audit });
    expect(audits.map((a) => a.action)).toEqual(["decision.brief_drafted", "decision.recorded"]);
    expect(audits[0].entityId).toBe(brief.id);
    expect(audits[0].actorId).toBe("user_1");
  });
});

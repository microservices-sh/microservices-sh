// @microservices-sh/decision — Advise pillar.
// Decision briefs (cited, human-owned) that close into action + an append-only decision log.
// Domain logic only; ports are injected (proposer = LLM draft, store = persistence).

import { z } from "zod";

export type DecisionSourceRef = { id: string; title: string; uri: string };

export type DecisionOption = { id: string; summary: string };

export type DecisionRisk = { summary: string; severity: "low" | "medium" | "high" };

export type DecisionRecommendation = {
  summary: string;
  optionId: string;
  sourceIds: string[];
};

export type DecisionBriefStatus = "draft" | "accepted" | "rejected" | "deferred";

export type DecisionBrief = {
  id: string;
  question: string;
  context: string;
  sources: DecisionSourceRef[];
  options: DecisionOption[];
  risks: DecisionRisk[];
  assumptions: string[];
  recommendation: DecisionRecommendation;
  ownerId: string;
  status: DecisionBriefStatus;
  createdAt: string;
};

export type DecisionProposal = {
  options: DecisionOption[];
  risks: DecisionRisk[];
  assumptions: string[];
  recommendation: DecisionRecommendation;
};

export interface DecisionProposer {
  propose(input: {
    question: string;
    context: string;
    sources: DecisionSourceRef[];
  }): Promise<DecisionProposal>;
}

export type DecisionChoice = "accept" | "reject" | "defer";

export type DecisionLog = {
  id: string;
  briefId: string;
  choice: DecisionChoice;
  rationale: string;
  ownerId: string;
  decidedAt: string;
};

export type DomainEvent = {
  eventName: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
};

export interface DecisionStore {
  saveBrief(brief: DecisionBrief): Promise<void>;
  getBrief(briefId: string): Promise<DecisionBrief | null>;
  appendLog(log: DecisionLog): Promise<void>;
  listLogs(briefId: string): Promise<DecisionLog[]>;
  writeEvent(event: DomainEvent): Promise<void>;
}

export type MemoryDecisionStore = DecisionStore & { listEvents(): DomainEvent[] };

export function createMemoryDecisionStore(): MemoryDecisionStore {
  const briefs = new Map<string, DecisionBrief>();
  const logs: DecisionLog[] = [];
  const events: DomainEvent[] = [];
  return {
    async saveBrief(brief) {
      briefs.set(brief.id, brief);
    },
    async getBrief(briefId) {
      return briefs.get(briefId) ?? null;
    },
    async appendLog(log) {
      logs.push(log);
    },
    async listLogs(briefId) {
      return logs.filter((log) => log.briefId === briefId);
    },
    async writeEvent(event) {
      events.push(event);
    },
    listEvents() {
      return [...events];
    }
  };
}

const STATUS_BY_CHOICE: Record<DecisionChoice, DecisionBriefStatus> = {
  accept: "accepted",
  reject: "rejected",
  defer: "deferred"
};

export type Actor = { id: string; scopes: string[] };

export type AuditEntry = {
  action: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
};

// Governance sink (the audit-log module). Injected; optional for internal calls.
export interface AuditSink {
  record(entry: AuditEntry): Promise<void>;
}

const ADMIN_SCOPE = "decision.admin";

// Fail-closed authorization. A missing actor is never an implicit bypass:
// trusted internal callers must construct an explicit system Actor with scopes.
function authorize(actor: Actor | null | undefined, scope: string) {
  if (!actor) {
    return { ok: false as const, status: 401 as const, error: { code: "UNAUTHENTICATED", message: "Actor required." } };
  }
  if (!actor.scopes.includes(scope)) {
    return { ok: false as const, status: 403 as const, error: { code: "FORBIDDEN", message: `Requires scope ${scope}.` } };
  }
  return null;
}

// Ownership gate: the brief owner, or an actor holding decision.admin.
function canAccessBrief(actor: Actor, brief: DecisionBrief): boolean {
  return brief.ownerId === actor.id || actor.scopes.includes(ADMIN_SCOPE);
}

// Used when a brief is absent OR not visible to the actor — identical shape for
// both so it cannot be used as an existence oracle.
function notFound(briefId: string) {
  return { ok: false as const, status: 404 as const, error: { code: "DECISION_NOT_FOUND", message: `No decision brief ${briefId}.` } };
}

export type ActionRequest = {
  kind: "task";
  title: string;
  ownerId: string;
  decisionBriefId: string;
};

// Closes advice into action: an accepted brief hands a task to an executor
// (operator-work / jobs-workflows). Injected so the module stays decoupled.
export interface ActionDispatcher {
  dispatch(request: ActionRequest): Promise<{ taskId: string }>;
}

const isoFrom = (now: () => number) => new Date(now()).toISOString();

function invalidDecisionInput(issues: unknown) {
  return {
    ok: false as const,
    status: 400 as const,
    error: { code: "INVALID_DECISION_INPUT", message: "Decision input is invalid.", issues }
  };
}

export const sourceRefSchema = z.object({ id: z.string().min(1), title: z.string(), uri: z.string() });

export const draftInputSchema = z.object({
  question: z.string().min(1),
  context: z.string(),
  sources: z.array(sourceRefSchema)
});

export async function draftDecisionBrief(
  input: {
    question: string;
    context: string;
    sources: DecisionSourceRef[];
  },
  deps: {
    store: DecisionStore;
    proposer: DecisionProposer;
    now: () => number;
    actor: Actor;
    audit?: AuditSink;
  }
) {
  const auth = authorize(deps.actor, "decision.write");
  if (auth) return auth;

  const parsed = draftInputSchema.safeParse(input);
  if (!parsed.success) return invalidDecisionInput(parsed.error.issues);
  const data = parsed.data;

  const proposal = await deps.proposer.propose({
    question: data.question,
    context: data.context,
    sources: data.sources
  });

  // Cite-or-refuse: a recommendation must cite at least one provided source.
  // Uncited advice is the chatbot failure mode this module exists to prevent.
  const providedSourceIds = new Set(data.sources.map((source) => source.id));
  const citedIds = proposal.recommendation.sourceIds;
  const isCited = citedIds.length > 0 && citedIds.every((id) => providedSourceIds.has(id));
  if (!isCited) {
    return {
      ok: false as const,
      status: 422 as const,
      error: {
        code: "DECISION_UNCITED",
        message: "Recommendation must cite at least one provided source.",
        citedSourceIds: citedIds,
        providedSourceIds: [...providedSourceIds]
      }
    };
  }

  const brief: DecisionBrief = {
    id: `dec_${crypto.randomUUID().slice(0, 12)}`,
    question: data.question,
    context: data.context,
    sources: data.sources,
    options: proposal.options,
    risks: proposal.risks,
    assumptions: proposal.assumptions,
    recommendation: proposal.recommendation,
    ownerId: deps.actor.id,
    status: "draft",
    createdAt: isoFrom(deps.now)
  };

  await deps.store.saveBrief(brief);
  await deps.store.writeEvent({
    eventName: "decision.brief_drafted",
    entityType: "decision_brief",
    entityId: brief.id,
    payload: { ownerId: brief.ownerId, briefId: brief.id }
  });
  await deps.audit?.record({
    action: "decision.brief_drafted",
    actorId: deps.actor.id,
    entityType: "decision_brief",
    entityId: brief.id
  });

  return { ok: true as const, status: 201 as const, data: { brief } };
}

// Edge: research -> advise. A research brief grounds a decision — its answer
// becomes the decision context, its citations become the citeable sources.
// Structurally typed so `decision` stays independent of `@microservices-sh/research`
// (the composer passes a real ResearchBrief, which is shape-compatible).
export type ResearchBriefLike = {
  id: string;
  question: string;
  answer: string;
  citations: { sourceFile: string }[];
};

export async function draftDecisionFromResearch(
  input: { research: ResearchBriefLike; question?: string },
  deps: {
    store: DecisionStore;
    proposer: DecisionProposer;
    now: () => number;
    actor: Actor;
    audit?: AuditSink;
  }
) {
  const { research } = input;
  const sources: DecisionSourceRef[] = research.citations.map((citation, index) => ({
    id: `rs_${index}`,
    title: citation.sourceFile,
    uri: `research://brief/${research.id}#${citation.sourceFile}`
  }));

  return draftDecisionBrief(
    {
      question: input.question ?? `Decision grounded in research: ${research.question}`,
      context: research.answer,
      sources
    },
    deps
  );
}

export const recordInputSchema = z.object({
  briefId: z.string().min(1),
  choice: z.enum(["accept", "reject", "defer"]),
  rationale: z.string()
});

export async function recordDecision(
  input: {
    briefId: string;
    choice: DecisionChoice;
    rationale: string;
  },
  deps: {
    store: DecisionStore;
    now: () => number;
    dispatcher?: ActionDispatcher;
    actor: Actor;
    audit?: AuditSink;
  }
) {
  const auth = authorize(deps.actor, "decision.write");
  if (auth) return auth;

  const parsed = recordInputSchema.safeParse(input);
  if (!parsed.success) return invalidDecisionInput(parsed.error.issues);
  const { briefId, choice, rationale } = parsed.data;

  const brief = await deps.store.getBrief(briefId);
  if (!brief || !canAccessBrief(deps.actor, brief)) return notFound(briefId);

  // ownerId is derived from the authenticated actor, never the client payload.
  const ownerId = deps.actor.id;

  const log: DecisionLog = {
    id: `dlog_${crypto.randomUUID().slice(0, 12)}`,
    briefId,
    choice,
    rationale,
    ownerId,
    decidedAt: isoFrom(deps.now)
  };
  await deps.store.appendLog(log);

  brief.status = STATUS_BY_CHOICE[choice];
  await deps.store.saveBrief(brief);

  await deps.store.writeEvent({
    eventName: "decision.recorded",
    entityType: "decision_brief",
    entityId: briefId,
    payload: { choice, ownerId }
  });
  await deps.audit?.record({
    action: "decision.recorded",
    actorId: deps.actor.id,
    entityType: "decision_brief",
    entityId: briefId
  });

  // Only an accepted decision closes into action.
  let actionRequest: (ActionRequest & { taskId?: string }) | undefined;
  if (choice === "accept") {
    const request: ActionRequest = {
      kind: "task",
      title: brief.recommendation.summary,
      ownerId,
      decisionBriefId: briefId
    };
    if (deps.dispatcher) {
      const { taskId } = await deps.dispatcher.dispatch(request);
      actionRequest = { ...request, taskId };
    } else {
      actionRequest = request;
    }
  }

  return { ok: true as const, status: 201 as const, data: { log, brief, actionRequest } };
}

export async function listDecisions(input: { briefId: string }, deps: { store: DecisionStore; actor: Actor }) {
  const auth = authorize(deps.actor, "decision.read");
  if (auth) return auth;

  const brief = await deps.store.getBrief(input.briefId);
  if (!brief || !canAccessBrief(deps.actor, brief)) return notFound(input.briefId);

  const logs = await deps.store.listLogs(input.briefId);
  return { ok: true as const, status: 200 as const, data: { logs } };
}

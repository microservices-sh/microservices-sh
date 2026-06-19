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

// Returns a 403 result when an actor is present but lacks the scope. A missing
// actor means a trusted internal call (no gate) — route adapters always pass one.
function forbiddenFor(actor: Actor | null | undefined, scope: string) {
  if (actor && !actor.scopes.includes(scope)) {
    return {
      ok: false as const,
      status: 403 as const,
      error: { code: "FORBIDDEN", message: `Requires scope ${scope}.` }
    };
  }
  return null;
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

export const sourceRefSchema = z.object({ id: z.string().min(1), title: z.string(), uri: z.string() });

export const draftInputSchema = z.object({
  question: z.string().min(1),
  context: z.string(),
  sources: z.array(sourceRefSchema),
  ownerId: z.string().min(1)
});

export async function draftDecisionBrief(
  input: {
    question: string;
    context: string;
    sources: DecisionSourceRef[];
    ownerId: string;
  },
  deps: {
    store: DecisionStore;
    proposer: DecisionProposer;
    now: () => number;
    actor?: Actor | null;
    audit?: AuditSink;
  }
) {
  const parsed = draftInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: {
        code: "INVALID_DECISION_INPUT",
        message: "Decision input is invalid.",
        issues: parsed.error.issues
      }
    };
  }
  input = parsed.data;

  const forbidden = forbiddenFor(deps.actor, "decision.write");
  if (forbidden) return forbidden;

  const proposal = await deps.proposer.propose({
    question: input.question,
    context: input.context,
    sources: input.sources
  });

  // Cite-or-refuse: a recommendation must cite at least one provided source.
  // Uncited advice is the chatbot failure mode this module exists to prevent.
  const providedSourceIds = new Set(input.sources.map((source) => source.id));
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
    question: input.question,
    context: input.context,
    sources: input.sources,
    options: proposal.options,
    risks: proposal.risks,
    assumptions: proposal.assumptions,
    recommendation: proposal.recommendation,
    ownerId: input.ownerId,
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
    actorId: deps.actor?.id ?? null,
    entityType: "decision_brief",
    entityId: brief.id
  });

  return { ok: true as const, status: 201 as const, data: { brief } };
}

export const recordInputSchema = z.object({
  briefId: z.string().min(1),
  choice: z.enum(["accept", "reject", "defer"]),
  rationale: z.string(),
  ownerId: z.string().min(1)
});

export async function recordDecision(
  input: {
    briefId: string;
    choice: DecisionChoice;
    rationale: string;
    ownerId: string;
  },
  deps: {
    store: DecisionStore;
    now: () => number;
    dispatcher?: ActionDispatcher;
    actor?: Actor | null;
    audit?: AuditSink;
  }
) {
  const parsed = recordInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: { code: "INVALID_DECISION_INPUT", message: "Decision input is invalid.", issues: parsed.error.issues }
    };
  }
  const { briefId, choice, rationale, ownerId } = parsed.data;

  const forbidden = forbiddenFor(deps.actor, "decision.write");
  if (forbidden) return forbidden;

  const brief = await deps.store.getBrief(briefId);
  if (!brief) {
    return {
      ok: false as const,
      status: 404 as const,
      error: { code: "DECISION_NOT_FOUND", message: `No decision brief ${briefId}.` }
    };
  }

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
    actorId: deps.actor?.id ?? null,
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

export async function listDecisions(input: { briefId: string }, deps: { store: DecisionStore }) {
  const logs = await deps.store.listLogs(input.briefId);
  return { ok: true as const, status: 200 as const, data: { logs } };
}

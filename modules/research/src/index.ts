// @microservices-sh/research — Research pillar (GraphRAG).
// Retrieval is graph-based: markdown/files (per-client Fly volume, optionally
// backed up to R2) are turned into a knowledge graph by graphify (batch), loaded
// into a GraphStore, and queried at runtime via a Retriever. Synthesis produces
// CITED research briefs and refuses when nothing grounds the question
// (cite-or-refuse). Graph/loader/retriever live in ./graph.

import { z } from "zod";
import type { Passage, Retriever } from "./graph";

export * from "./graph";
export { loadGraphifyDir } from "./adapters/graphify-out-loader";
export { runGraphBuild, type BuildMode } from "./build-graph";
export { opsRead, DEFAULT_OPS_TOOLS, type OpsClient, type OpsRecord, type OpsToolCall, type OpsToolRegistry } from "./ops";
export { createOperateHttpClient } from "./adapters/operate-http-client";
export { handleOpsRequest, type OpsServerRegistry, type OpsServerTool, type OpsToolHandler, type OpsTokenVerifier } from "./ops-server";
export { createOpsHandler } from "./ops-http";
export { mintOpsToken, createOpsTokenVerifier } from "./ops-token";
export { operationalBrief } from "./ops-brief";
export {
  OPS_TOOL_SCOPES,
  createOpsRegistry,
  toCustomerRecord,
  toInvoiceRecord,
  toBookingRecord,
  toTicketRecord,
  toCalendarRecord,
  type OpsToolName
} from "./ops-registry";
export { planOpsTools } from "./ops-plan";
export { assistedBrief } from "./assist";
export { createGroundedAnswerer } from "./grounded-answerer";
export { customerSummary } from "./customer-summary";
export { loadWorkspaceConfig, WORKSPACE_MAX_TOPK, type WorkspaceConfig, type WorkspaceSettings } from "./workspace";

export type Actor = { id: string; scopes: string[] };

export type Citation = { sourceFile: string; sourceLocation?: string };

export type ResearchBrief = {
  id: string;
  question: string;
  answer: string;
  citations: Citation[];
  ownerId: string;
  createdAt: string;
};

export type DomainEvent = { eventName: string; entityType: string; entityId: string; payload: Record<string, unknown> };
export type AuditEntry = { action: string; actorId: string; entityType: string; entityId: string };

export interface Synthesizer {
  synthesize(input: { question: string; passages: Passage[] }): Promise<{ answer: string; citedSourceFiles: string[] }>;
}

export interface AuditSink {
  record(entry: AuditEntry): Promise<void>;
}

export interface ResearchStore {
  saveBrief(brief: ResearchBrief): Promise<void>;
  getBrief(briefId: string): Promise<ResearchBrief | null>;
  writeEvent(event: DomainEvent): Promise<void>;
}

const ADMIN_SCOPE = "research.admin";

function authorize(actor: Actor | null | undefined, scope: string) {
  if (!actor) return { ok: false as const, status: 401 as const, error: { code: "UNAUTHENTICATED", message: "Actor required." } };
  if (!actor.scopes.includes(scope)) return { ok: false as const, status: 403 as const, error: { code: "FORBIDDEN", message: `Requires scope ${scope}.` } };
  return null;
}

function notFound(entityId: string) {
  return { ok: false as const, status: 404 as const, error: { code: "RESEARCH_NOT_FOUND", message: `No research entity ${entityId}.` } };
}

function invalidInput(issues: unknown) {
  return { ok: false as const, status: 400 as const, error: { code: "INVALID_RESEARCH_INPUT", message: "Research input is invalid.", issues } };
}

const isoFrom = (now: () => number) => new Date(now()).toISOString();

export type MemoryResearchStore = ResearchStore & { listEvents(): DomainEvent[] };

export function createMemoryResearchStore(): MemoryResearchStore {
  const briefs = new Map<string, ResearchBrief>();
  const events: DomainEvent[] = [];
  return {
    async saveBrief(brief) {
      briefs.set(brief.id, brief);
    },
    async getBrief(briefId) {
      return briefs.get(briefId) ?? null;
    },
    async writeEvent(event) {
      events.push(event);
    },
    listEvents() {
      return [...events];
    }
  };
}

const researchInputSchema = z.object({
  question: z.string().min(1),
  topK: z.number().int().positive().max(50).optional()
});

export async function research(
  input: { question: string; topK?: number },
  deps: {
    store: ResearchStore;
    retriever: Retriever;
    synthesizer: Synthesizer;
    now: () => number;
    actor: Actor;
    audit?: AuditSink;
  }
) {
  const auth = authorize(deps.actor, "research.read");
  if (auth) return auth;

  const parsed = researchInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error.issues);
  const { question, topK } = parsed.data;

  const passages = await deps.retriever.retrieve({
    text: question,
    topK: topK ?? 8,
    ownerId: deps.actor.id,
    admin: deps.actor.scopes.includes(ADMIN_SCOPE)
  });

  // Cite-or-refuse: never answer ungrounded. No retrieved passages -> refuse.
  if (passages.length === 0) {
    return { ok: false as const, status: 422 as const, error: { code: "RESEARCH_NO_SOURCES", message: "No grounded sources for this question." } };
  }

  const { answer, citedSourceFiles } = await deps.synthesizer.synthesize({ question, passages });

  const retrieved = new Set(passages.map((passage) => passage.sourceFile));
  const grounded = citedSourceFiles.length > 0 && citedSourceFiles.every((file) => retrieved.has(file));
  if (!grounded) {
    return {
      ok: false as const,
      status: 422 as const,
      error: { code: "RESEARCH_UNCITED", message: "Synthesis must cite only retrieved sources.", citedSourceFiles, retrievedSourceFiles: [...retrieved] }
    };
  }

  const ownerId = deps.actor.id;
  const brief: ResearchBrief = {
    id: `rsb_${crypto.randomUUID().slice(0, 12)}`,
    question,
    answer,
    citations: citedSourceFiles.map((sourceFile) => ({ sourceFile })),
    ownerId,
    createdAt: isoFrom(deps.now)
  };
  await deps.store.saveBrief(brief);

  await deps.store.writeEvent({
    eventName: "research.brief_created",
    entityType: "research_brief",
    entityId: brief.id,
    payload: { ownerId, citations: brief.citations.length }
  });
  await deps.audit?.record({ action: "research.brief_created", actorId: ownerId, entityType: "research_brief", entityId: brief.id });

  return { ok: true as const, status: 201 as const, data: { brief } };
}

export async function getBrief(input: { briefId: string }, deps: { store: ResearchStore; actor: Actor }) {
  const auth = authorize(deps.actor, "research.read");
  if (auth) return auth;
  const brief = await deps.store.getBrief(input.briefId);
  const visible = brief && (brief.ownerId === deps.actor.id || deps.actor.scopes.includes(ADMIN_SCOPE));
  if (!visible) return notFound(input.briefId);
  return { ok: true as const, status: 200 as const, data: { brief } };
}

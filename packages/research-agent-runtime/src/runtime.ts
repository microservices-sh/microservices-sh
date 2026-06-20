// Per-client Fly runtime composition: wires research + decision + ai-gateway
// over one SQLite database (node:sqlite on the Fly volume, or libsql). The DB is
// opened + migrated by the entrypoint (server.ts) and injected here, along with
// a ContentReader (reads source files off the volume) and the AI config/providers.
//
// Boots once; returns ready-to-call operations that carry an actor through
// retrieval, governed AI egress, cite-or-refuse, persistence, and audit.
import { complete, type AiConfig, type ProviderRegistry } from "@microservices-sh/ai-gateway";
import {
  assistedBrief,
  createGraphRetriever,
  getBrief,
  loadGraphifyOutput,
  research,
  type ContentReader,
  type OpsClient
} from "@microservices-sh/research";
import type { SqlDatabase } from "@microservices-sh/research/adapters/sqlite-graph";
import { createSqliteGraphStore } from "@microservices-sh/research/adapters/sqlite-graph";
import { createSqliteResearchStore } from "@microservices-sh/research/adapters/sqlite-research-store";
import { createGatewaySynthesizer } from "@microservices-sh/research/adapters/gateway-synthesizer";
import { draftDecisionFromResearch, listDecisions, recordDecision } from "@microservices-sh/decision";
import {
  createSqliteDecisionStore,
  type SqlDatabase as DecisionSqlDatabase
} from "@microservices-sh/decision/adapters/sqlite-decision-store";
import { createGatewayProposer } from "@microservices-sh/decision/adapters/gateway-proposer";

export type RuntimeActor = { id: string; tenantId?: string; scopes: string[] };

export function bootResearchRuntime(opts: {
  db: SqlDatabase;
  readContent: ContentReader;
  ai: { config: AiConfig; providers: ProviderRegistry };
  now?: () => number;
  // Optional read-back into the client's operate app (Plan 32). When wired, the
  // agent can blend live operational records with the local knowledge graph.
  opsClient?: OpsClient;
}) {
  const graph = createSqliteGraphStore(opts.db);
  const researchStore = createSqliteResearchStore(opts.db);
  const decisionStore = createSqliteDecisionStore(opts.db as unknown as DecisionSqlDatabase);
  const retriever = createGraphRetriever(graph, { readContent: opts.readContent });
  const now = opts.now ?? (() => Date.now());

  // Bind ai-gateway for one actor (governance — authz/budget/audit/meter — applies per call).
  const completeFor = (actor: RuntimeActor) => async (messages: { role: "system" | "user" | "assistant"; content: string }[]) => {
    const result = await complete({ messages }, { config: opts.ai.config, providers: opts.ai.providers, actor });
    return result ?? { ok: false as const, status: 500 as const, error: { code: "AI_NO_RESPONSE" } };
  };

  return {
    /** Load a graphify output (run off-box / on boot) into the graph store. */
    loadGraph: (graphify: Parameters<typeof loadGraphifyOutput>[0], ownerId: string) =>
      loadGraphifyOutput(graphify, { store: graph, ownerId }),

    /** Research a question → cited brief grounded in the owner's graph. */
    research: (input: { question: string; topK?: number }, actor: RuntimeActor) =>
      research(input, { store: researchStore, retriever, synthesizer: createGatewaySynthesizer(completeFor(actor)), now, actor }),

    /** Assist a question → blended brief over the local graph (knowledge) AND a
     *  live operate-plane read-back (ops), when an opsClient is wired. */
    assist: (input: { question: string; topK?: number }, actor: RuntimeActor) =>
      assistedBrief(input, {
        graphRetriever: retriever,
        client: opts.opsClient ?? { async read() { return []; } },
        store: researchStore,
        synthesizer: createGatewaySynthesizer(completeFor(actor)),
        now,
        actor
      }),

    getResearchBrief: (briefId: string, actor: RuntimeActor) => getBrief({ briefId }, { store: researchStore, actor }),

    /** Ground a decision in a research brief (research → advise edge). */
    draftDecisionFromResearch: (
      input: { research: Parameters<typeof draftDecisionFromResearch>[0]["research"]; question?: string },
      actor: RuntimeActor
    ) => draftDecisionFromResearch(input, { store: decisionStore, proposer: createGatewayProposer(completeFor(actor)), now, actor }),

    /** Record a decision — closes into action + append-only log. */
    recordDecision: (input: { briefId: string; choice: "accept" | "reject" | "defer"; rationale: string }, actor: RuntimeActor) =>
      recordDecision(input, { store: decisionStore, now, actor }),

    listDecisions: (briefId: string, actor: RuntimeActor) => listDecisions({ briefId }, { store: decisionStore, actor })
  };
}

export type ResearchRuntime = ReturnType<typeof bootResearchRuntime>;

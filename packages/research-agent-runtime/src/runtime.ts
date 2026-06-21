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
  type OpsClient,
  type WorkspaceConfig
} from "@microservices-sh/research";
import { OPS_TOOL_SCOPES } from "@microservices-sh/research/ops-registry";
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
  // Optional workspace config (/data/workspace): identity/policy preamble +
  // cosmetic settings (topK, opsTools). Shapes voice/scope, never grounding.
  workspace?: WorkspaceConfig;
}) {
  const graph = createSqliteGraphStore(opts.db);
  const researchStore = createSqliteResearchStore(opts.db);
  const decisionStore = createSqliteDecisionStore(opts.db as unknown as DecisionSqlDatabase);
  const retriever = createGraphRetriever(graph, { readContent: opts.readContent });
  const now = opts.now ?? (() => Date.now());

  const preamble = opts.workspace?.systemPreamble;
  const defaultTopK = opts.workspace?.settings.topK;
  // opsTools narrowing (narrow-only): when the workspace lists allowed tools,
  // drop ops.* scopes whose tool isn't listed. Non-ops scopes are untouched, and
  // a tool the box was never granted can't be added (opsRead's scope check is the
  // backstop). Absent ⇒ unchanged.
  const allowedOpsScopes: Set<string> | null = opts.workspace?.settings.opsTools
    ? new Set<string>(
        opts.workspace.settings.opsTools
          .map((tool) => OPS_TOOL_SCOPES[tool as keyof typeof OPS_TOOL_SCOPES] as string | undefined)
          .filter((scope) => Boolean(scope)) as string[]
      )
    : null;
  const allOpsScopes = new Set<string>(Object.values(OPS_TOOL_SCOPES));
  const narrowOps = (actor: RuntimeActor): RuntimeActor =>
    allowedOpsScopes
      ? { ...actor, scopes: actor.scopes.filter((s) => !allOpsScopes.has(s) || allowedOpsScopes.has(s)) }
      : actor;

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
      research(
        { ...input, topK: input.topK ?? defaultTopK },
        { store: researchStore, retriever, synthesizer: createGatewaySynthesizer(completeFor(actor), { preamble }), now, actor }
      ),

    /** Assist a question → blended brief over the local graph (knowledge) AND a
     *  live operate-plane read-back (ops), when an opsClient is wired. */
    assist: (input: { question: string; topK?: number }, actor: RuntimeActor) =>
      assistedBrief(
        { ...input, topK: input.topK ?? defaultTopK },
        {
          graphRetriever: retriever,
          client: opts.opsClient ?? { async read() { return []; } },
          store: researchStore,
          synthesizer: createGatewaySynthesizer(completeFor(actor), { preamble }),
          now,
          actor: narrowOps(actor)
        }
      ),

    getResearchBrief: (briefId: string, actor: RuntimeActor) => getBrief({ briefId }, { store: researchStore, actor }),

    /** Ground a decision in a research brief (research → advise edge). */
    draftDecisionFromResearch: (
      input: { research: Parameters<typeof draftDecisionFromResearch>[0]["research"]; question?: string },
      actor: RuntimeActor
    ) => draftDecisionFromResearch(input, { store: decisionStore, proposer: createGatewayProposer(completeFor(actor), { preamble }), now, actor }),

    /** Record a decision — closes into action + append-only log. */
    recordDecision: (input: { briefId: string; choice: "accept" | "reject" | "defer"; rationale: string }, actor: RuntimeActor) =>
      recordDecision(input, { store: decisionStore, now, actor }),

    listDecisions: (briefId: string, actor: RuntimeActor) => listDecisions({ briefId }, { store: decisionStore, actor })
  };
}

export type ResearchRuntime = ReturnType<typeof bootResearchRuntime>;

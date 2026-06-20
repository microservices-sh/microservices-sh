// Assisted brief (Plan 32, P4) — blended retrieval across both planes.
//
// The agent's general answer path: plan which operations tools a question implies,
// gather KNOWLEDGE passages from the graph AND LIVE passages from those ops tools,
// then synthesize one cite-or-refuse brief grounded in both. This is what
// "assist a company's operation" means — combine *how we do things* (graph) with
// *this entity's current state* (ops). Pure knowledge questions never touch ops;
// ops tools the actor isn't scoped for are skipped (best-effort), not fatal.

import type { Actor, AuditSink, Passage, ResearchBrief, ResearchStore, Retriever, Synthesizer } from "./index";
import { type OpsClient, type OpsToolRegistry, opsRead } from "./ops";
import { planOpsTools } from "./ops-plan";

const isoFrom = (now: () => number) => new Date(now()).toISOString();

export async function assistedBrief(
  input: { question: string; topK?: number },
  deps: {
    graphRetriever: Retriever;
    client: OpsClient;
    store: ResearchStore;
    synthesizer: Synthesizer;
    now: () => number;
    actor: Actor;
    audit?: AuditSink;
    registry?: OpsToolRegistry;
    plan?: (question: string) => string[];
  }
) {
  const ownerId = deps.actor.id;
  const admin = deps.actor.scopes.includes("research.admin");
  const topK = input.topK ?? 8;

  // Knowledge plane.
  const graphPassages = await deps.graphRetriever.retrieve({ text: input.question, topK, ownerId, admin });

  // Operations plane — only the tools the question implies.
  const tools = (deps.plan ?? planOpsTools)(input.question);
  const opsPassages: Passage[] = [];
  for (const tool of tools) {
    const read = await opsRead(
      { tool, args: { query: input.question } },
      { client: deps.client, actor: deps.actor, now: deps.now, registry: deps.registry, audit: deps.audit }
    );
    if (read.ok) opsPassages.push(...read.data.passages); // skip refusals (e.g. unscoped) best-effort
  }

  const passages = [...graphPassages, ...opsPassages];
  const planes = { graph: graphPassages.length, ops: opsPassages.length };

  // Cite-or-refuse across both planes.
  if (passages.length === 0) {
    return { ok: false as const, status: 422 as const, error: { code: "ASSIST_NO_SOURCES", message: "Neither knowledge nor live records ground this question." } };
  }

  const { answer, citedSourceFiles } = await deps.synthesizer.synthesize({ question: input.question, passages });
  const retrieved = new Set(passages.map((passage) => passage.sourceFile));
  const grounded = citedSourceFiles.length > 0 && citedSourceFiles.every((ref) => retrieved.has(ref));
  if (!grounded) {
    return {
      ok: false as const,
      status: 422 as const,
      error: { code: "ASSIST_UNCITED", message: "Synthesis must cite only retrieved sources.", citedSourceFiles, retrievedSourceFiles: [...retrieved] }
    };
  }

  const brief: ResearchBrief = {
    id: `asb_${crypto.randomUUID().slice(0, 12)}`,
    question: input.question,
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
    payload: { ownerId, citations: brief.citations.length, source: "assist", planes }
  });
  await deps.audit?.record({ action: "assist.brief_created", actorId: ownerId, entityType: "research_brief", entityId: brief.id });

  return { ok: true as const, status: 201 as const, data: { brief, planes } };
}

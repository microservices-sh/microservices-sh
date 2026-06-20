// Operational brief (Plan 32, P1 — the user-facing payoff). Mirrors research()
// but grounds on LIVE operate-plane records instead of the static graph: read a
// governed ops tool, refuse-or-synthesize a cited brief, persist + audit it.
// Citations point at the live record ref (module:entityId), so the same
// cite-or-refuse trust contract holds for operational answers as for knowledge.

import type { Actor, AuditSink, ResearchBrief, ResearchStore, Synthesizer } from "./index";
import { type OpsClient, type OpsToolRegistry, opsRead } from "./ops";

const isoFrom = (now: () => number) => new Date(now()).toISOString();

export async function operationalBrief(
  input: { question: string; tool: string; args?: Record<string, unknown> },
  deps: {
    client: OpsClient;
    store: ResearchStore;
    synthesizer: Synthesizer;
    now: () => number;
    actor: Actor;
    audit?: AuditSink;
    registry?: OpsToolRegistry;
  }
) {
  // Governed live read (fail-closed authz + audit live inside opsRead). A
  // governance refusal (unknown tool / missing scope) propagates verbatim.
  const read = await opsRead(
    { tool: input.tool, args: input.args ?? {} },
    { client: deps.client, actor: deps.actor, now: deps.now, registry: deps.registry, audit: deps.audit }
  );
  if (!read.ok) return read;

  const passages = read.data.passages;

  // Cite-or-refuse: never answer ungrounded.
  if (passages.length === 0) {
    return { ok: false as const, status: 422 as const, error: { code: "OPS_NO_SOURCES", message: "No live records ground this question." } };
  }

  const { answer, citedSourceFiles } = await deps.synthesizer.synthesize({ question: input.question, passages });

  const retrieved = new Set(passages.map((passage) => passage.sourceFile));
  const grounded = citedSourceFiles.length > 0 && citedSourceFiles.every((ref) => retrieved.has(ref));
  if (!grounded) {
    return {
      ok: false as const,
      status: 422 as const,
      error: { code: "OPS_UNCITED", message: "Synthesis must cite only retrieved records.", citedSourceFiles, retrievedSourceFiles: [...retrieved] }
    };
  }

  const ownerId = deps.actor.id;
  const brief: ResearchBrief = {
    id: `osb_${crypto.randomUUID().slice(0, 12)}`,
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
    payload: { ownerId, citations: brief.citations.length, source: "ops", tool: input.tool }
  });
  await deps.audit?.record({ action: "ops.brief_created", actorId: ownerId, entityType: "research_brief", entityId: brief.id });

  return { ok: true as const, status: 201 as const, data: { brief } };
}

// @microservices-sh/research — Research pillar.
// Ingest company knowledge, retrieve by semantic search, and produce CITED
// research briefs. Refuses to answer without grounded sources (cite-or-refuse).
// Domain logic only; embedding/vector/LLM/persistence are injected ports.

import { z } from "zod";

export type Actor = { id: string; scopes: string[] };

export type ResearchSource = {
  id: string;
  title: string;
  uri: string;
  ownerId: string;
  chunkCount: number;
  createdAt: string;
};

export type VectorRecord = {
  id: string;
  sourceId: string;
  chunkIndex: number;
  text: string;
  vector: number[];
  ownerId: string;
};

export type Passage = { sourceId: string; text: string; score: number };

export type Citation = { sourceId: string };

export type ResearchBrief = {
  id: string;
  question: string;
  answer: string;
  citations: Citation[];
  ownerId: string;
  createdAt: string;
};

export type DomainEvent = {
  eventName: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
};

export type AuditEntry = { action: string; actorId: string; entityType: string; entityId: string };

export interface EmbeddingPort {
  embed(text: string): Promise<number[]>;
}

export interface VectorStore {
  upsert(records: VectorRecord[]): Promise<void>;
  query(q: { vector: number[]; topK: number; ownerId: string; admin?: boolean }): Promise<Passage[]>;
}

export interface Synthesizer {
  synthesize(input: { question: string; passages: Passage[] }): Promise<{ answer: string; citedSourceIds: string[] }>;
}

export interface AuditSink {
  record(entry: AuditEntry): Promise<void>;
}

export interface ResearchStore {
  saveSource(source: ResearchSource): Promise<void>;
  listSources(ownerId: string): Promise<ResearchSource[]>;
  saveBrief(brief: ResearchBrief): Promise<void>;
  getBrief(briefId: string): Promise<ResearchBrief | null>;
  writeEvent(event: DomainEvent): Promise<void>;
}

const ADMIN_SCOPE = "research.admin";

function authorize(actor: Actor | null | undefined, scope: string) {
  if (!actor) {
    return { ok: false as const, status: 401 as const, error: { code: "UNAUTHENTICATED", message: "Actor required." } };
  }
  if (!actor.scopes.includes(scope)) {
    return { ok: false as const, status: 403 as const, error: { code: "FORBIDDEN", message: `Requires scope ${scope}.` } };
  }
  return null;
}

function notFound(entityId: string) {
  return { ok: false as const, status: 404 as const, error: { code: "RESEARCH_NOT_FOUND", message: `No research entity ${entityId}.` } };
}

function invalidInput(issues: unknown) {
  return { ok: false as const, status: 400 as const, error: { code: "INVALID_RESEARCH_INPUT", message: "Research input is invalid.", issues } };
}

const isoFrom = (now: () => number) => new Date(now()).toISOString();

// Simple deterministic chunker: split on paragraph/sentence-ish boundaries,
// then pack into <= ~280-char chunks. Good enough for the MVP ingest path.
export function chunkContent(content: string, maxChars = 280): string[] {
  const trimmed = content.trim();
  if (trimmed.length <= maxChars) return [trimmed];
  const words = trimmed.split(/\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > maxChars) {
      chunks.push(current.trim());
      current = "";
    }
    current += `${word} `;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export type MemoryResearchStore = ResearchStore & { listEvents(): DomainEvent[] };

export function createMemoryResearchStore(): MemoryResearchStore {
  const sources = new Map<string, ResearchSource>();
  const briefs = new Map<string, ResearchBrief>();
  const events: DomainEvent[] = [];
  return {
    async saveSource(source) {
      sources.set(source.id, source);
    },
    async listSources(ownerId) {
      return [...sources.values()].filter((source) => source.ownerId === ownerId);
    },
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

export type MemoryVectorStore = VectorStore & { listRecords(): VectorRecord[] };

export function createMemoryVectorStore(): MemoryVectorStore {
  const records: VectorRecord[] = [];
  return {
    async upsert(incoming) {
      records.push(...incoming);
    },
    async query({ vector, topK, ownerId, admin }) {
      return records
        .filter((record) => admin || record.ownerId === ownerId)
        .map((record) => ({ sourceId: record.sourceId, text: record.text, score: cosine(vector, record.vector) }))
        .filter((passage) => passage.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    },
    listRecords() {
      return [...records];
    }
  };
}

const ingestInputSchema = z.object({
  title: z.string().min(1),
  uri: z.string().min(1),
  content: z.string().min(1)
});

export async function ingestSource(
  input: { title: string; uri: string; content: string },
  deps: {
    store: ResearchStore;
    vectorStore: VectorStore;
    embedder: EmbeddingPort;
    now: () => number;
    actor: Actor;
    audit?: AuditSink;
  }
) {
  const auth = authorize(deps.actor, "research.write");
  if (auth) return auth;

  const parsed = ingestInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error.issues);
  const data = parsed.data;

  const chunks = chunkContent(data.content);
  const sourceId = `src_${crypto.randomUUID().slice(0, 12)}`;
  const ownerId = deps.actor.id;

  const records: VectorRecord[] = [];
  for (let index = 0; index < chunks.length; index++) {
    const vector = await deps.embedder.embed(chunks[index]);
    records.push({
      id: `vec_${crypto.randomUUID().slice(0, 12)}`,
      sourceId,
      chunkIndex: index,
      text: chunks[index],
      vector,
      ownerId
    });
  }
  await deps.vectorStore.upsert(records);

  const source: ResearchSource = {
    id: sourceId,
    title: data.title,
    uri: data.uri,
    ownerId,
    chunkCount: chunks.length,
    createdAt: isoFrom(deps.now)
  };
  await deps.store.saveSource(source);

  await deps.store.writeEvent({
    eventName: "research.source_ingested",
    entityType: "research_source",
    entityId: sourceId,
    payload: { ownerId, chunkCount: chunks.length }
  });
  await deps.audit?.record({ action: "research.source_ingested", actorId: ownerId, entityType: "research_source", entityId: sourceId });

  return { ok: true as const, status: 201 as const, data: { source } };
}

const researchInputSchema = z.object({
  question: z.string().min(1),
  topK: z.number().int().positive().max(50).optional()
});

export async function research(
  input: { question: string; topK?: number },
  deps: {
    store: ResearchStore;
    vectorStore: VectorStore;
    embedder: EmbeddingPort;
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

  const queryVector = await deps.embedder.embed(question);
  const passages = await deps.vectorStore.query({
    vector: queryVector,
    topK: topK ?? 5,
    ownerId: deps.actor.id,
    admin: deps.actor.scopes.includes(ADMIN_SCOPE)
  });

  // Cite-or-refuse: never answer ungrounded. No retrieved passages -> refuse.
  if (passages.length === 0) {
    return { ok: false as const, status: 422 as const, error: { code: "RESEARCH_NO_SOURCES", message: "No grounded sources for this question." } };
  }

  const { answer, citedSourceIds } = await deps.synthesizer.synthesize({ question, passages });

  const retrievedIds = new Set(passages.map((passage) => passage.sourceId));
  const isGrounded = citedSourceIds.length > 0 && citedSourceIds.every((id) => retrievedIds.has(id));
  if (!isGrounded) {
    return {
      ok: false as const,
      status: 422 as const,
      error: { code: "RESEARCH_UNCITED", message: "Synthesis must cite only retrieved sources.", citedSourceIds, retrievedSourceIds: [...retrievedIds] }
    };
  }

  const ownerId = deps.actor.id;
  const brief: ResearchBrief = {
    id: `rsb_${crypto.randomUUID().slice(0, 12)}`,
    question,
    answer,
    citations: citedSourceIds.map((sourceId) => ({ sourceId })),
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

export async function listSources(deps: { store: ResearchStore; actor: Actor }) {
  const auth = authorize(deps.actor, "research.read");
  if (auth) return auth;
  const sources = await deps.store.listSources(deps.actor.id);
  return { ok: true as const, status: 200 as const, data: { sources } };
}

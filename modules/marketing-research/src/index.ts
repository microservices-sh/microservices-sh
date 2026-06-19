// @microservices-sh/marketing-research — composable, CITED marketing research.
// Pulls external signals (community listening, competitive/trend scan, keyword
// demand) through swappable ports, then synthesizes a marketing brief that
// CITES every claim and REFUSES when nothing grounds it (cite-or-refuse) — the
// same "no fake proof / governed" discipline the product sells, applied to
// marketing. v0 covers the SocialListen + Synthesizer ports; Keyword/Search
// ports are thin adapters added later. Real adapters (the /last30days engine as
// a SocialListenPort, ai-gateway as the Synthesizer) live behind these ports.

import { z } from "zod";

export type Actor = { id: string; scopes: string[] };

// One piece of external evidence. Every signal carries a real source URL so the
// brief can cite it — a signal with no URL cannot ground a claim.
export type Signal = {
  source: string; // e.g. "reddit", "hackernews", "github"
  sourceUrl: string;
  title: string;
  excerpt: string;
  engagement?: number;
};

// What was searched vs. what actually returned — surfaced in the brief so
// thin coverage never reads as completeness (coverage-honesty lesson).
export type Coverage = { searched: string[]; returned: string[]; note?: string };

export type Citation = { sourceUrl: string; title: string };

export type MarketingBrief = {
  id: string;
  topic: string;
  summary: string;
  implications: string[];
  citations: Citation[];
  coverage: Coverage;
  ownerId: string;
  createdAt: string;
};

export type DomainEvent = { eventName: string; entityType: string; entityId: string; payload: Record<string, unknown> };
export type AuditEntry = { action: string; actorId: string; entityType: string; entityId: string };

// ---- ports (swappable adapters) ----

export interface SocialListenPort {
  // Real adapter wraps the /last30days engine (Reddit/HN/GitHub). Returns
  // grounded signals + an honest coverage report.
  listen(input: { topic: string; channels?: string[]; ownerId: string; admin?: boolean }): Promise<{ signals: Signal[]; coverage: Coverage }>;
}

export interface Synthesizer {
  // Real adapter targets ai-gateway with a cite-constrained prompt. MUST cite
  // only the source URLs it was given; the use-case enforces this.
  synthesize(input: { topic: string; signals: Signal[] }): Promise<{ summary: string; implications: string[]; citedSourceUrls: string[] }>;
}

export interface AuditSink {
  record(entry: AuditEntry): Promise<void>;
}

export interface MarketingStore {
  saveBrief(brief: MarketingBrief): Promise<void>;
  getBrief(briefId: string): Promise<MarketingBrief | null>;
  writeEvent(event: DomainEvent): Promise<void>;
}

const ADMIN_SCOPE = "marketing.admin";

function authorize(actor: Actor | null | undefined, scope: string) {
  if (!actor) return { ok: false as const, status: 401 as const, error: { code: "UNAUTHENTICATED", message: "Actor required." } };
  if (!actor.scopes.includes(scope)) return { ok: false as const, status: 403 as const, error: { code: "FORBIDDEN", message: `Requires scope ${scope}.` } };
  return null;
}

function notFound(entityId: string) {
  return { ok: false as const, status: 404 as const, error: { code: "MARKETING_NOT_FOUND", message: `No marketing entity ${entityId}.` } };
}

function invalidInput(issues: unknown) {
  return { ok: false as const, status: 400 as const, error: { code: "INVALID_MARKETING_INPUT", message: "Marketing research input is invalid.", issues } };
}

const isoFrom = (now: () => number) => new Date(now()).toISOString();

// ---- memory store (tests + the dogfood CLI default; D1 adapter added later) ----

export type MemoryMarketingStore = MarketingStore & { listEvents(): DomainEvent[] };

export function createMemoryMarketingStore(): MemoryMarketingStore {
  const briefs = new Map<string, MarketingBrief>();
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

// ---- use-cases ----

const runResearchSchema = z.object({
  topic: z.string().min(1),
  channels: z.array(z.string().min(1)).optional()
});

export async function runResearch(
  input: { topic: string; channels?: string[] },
  deps: {
    store: MarketingStore;
    listen: SocialListenPort;
    synthesizer: Synthesizer;
    now: () => number;
    actor: Actor;
    audit?: AuditSink;
  }
) {
  const auth = authorize(deps.actor, "marketing.run");
  if (auth) return auth;

  const parsed = runResearchSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error.issues);
  const { topic, channels } = parsed.data;

  const ownerId = deps.actor.id;
  const admin = deps.actor.scopes.includes(ADMIN_SCOPE);
  const { signals, coverage } = await deps.listen.listen({ topic, channels, ownerId, admin });

  // Cite-or-refuse, part 1: no grounded signals -> refuse rather than invent demand.
  if (signals.length === 0) {
    return { ok: false as const, status: 422 as const, error: { code: "MARKETING_NO_SIGNALS", message: "No grounded signals for this topic.", coverage } };
  }

  const { summary, implications, citedSourceUrls } = await deps.synthesizer.synthesize({ topic, signals });

  // Cite-or-refuse, part 2: every cited URL must come from a real signal.
  // Guards against a synthesizer hallucinating sources or demand numbers.
  const available = new Set(signals.map((s) => s.sourceUrl));
  const grounded = citedSourceUrls.length > 0 && citedSourceUrls.every((url) => available.has(url));
  if (!grounded) {
    return {
      ok: false as const,
      status: 422 as const,
      error: { code: "MARKETING_UNCITED", message: "Synthesis must cite only the signals it was given.", citedSourceUrls, availableSourceUrls: [...available] }
    };
  }

  const byUrl = new Map(signals.map((s) => [s.sourceUrl, s] as const));
  const brief: MarketingBrief = {
    id: `mrb_${crypto.randomUUID().slice(0, 12)}`,
    topic,
    summary,
    implications,
    citations: citedSourceUrls.map((url) => ({ sourceUrl: url, title: byUrl.get(url)!.title })),
    coverage,
    ownerId,
    createdAt: isoFrom(deps.now)
  };
  await deps.store.saveBrief(brief);

  await deps.store.writeEvent({
    eventName: "marketing.brief_created",
    entityType: "marketing_brief",
    entityId: brief.id,
    payload: { ownerId, topic, citations: brief.citations.length }
  });
  await deps.audit?.record({ action: "marketing.brief_created", actorId: ownerId, entityType: "marketing_brief", entityId: brief.id });

  return { ok: true as const, status: 201 as const, data: { brief } };
}

export async function getBrief(input: { briefId: string }, deps: { store: MarketingStore; actor: Actor }) {
  const auth = authorize(deps.actor, "marketing.read");
  if (auth) return auth;
  const brief = await deps.store.getBrief(input.briefId);
  // Owner-scoped; non-visible returns 404 (not 403) to avoid an existence oracle.
  const visible = brief && (brief.ownerId === deps.actor.id || deps.actor.scopes.includes(ADMIN_SCOPE));
  if (!visible) return notFound(input.briefId);
  return { ok: true as const, status: 200 as const, data: { brief } };
}

// @microservices-sh/ai-gateway — governed AI egress.
// One provider-neutral boundary for embed/complete: BYOK provider resolution,
// fail-closed authz, audit, token metering, and cost caps. research/decision/
// agents call models through this so governance + metering apply uniformly.
// Provider clients are injected ports; real adapters (Workers AI, Anthropic,
// OpenAI, Gemini) implement ProviderClient. Prompts live in the callers.

import { z } from "zod";

export type Actor = { id: string; tenantId?: string; scopes: string[] };

export type AiProviderId =
  | "workers-ai"
  | "anthropic"
  | "openai"
  | "gemini"
  | "openrouter"
  | "gemma-ollama"
  | "gemma-openai-compatible";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type TokenUsage = { inputTokens: number; outputTokens: number };
export type EmbedUsage = { tokens: number };

export type AiConfig = {
  provider: AiProviderId;
  completeModel: string;
  embedModel: string;
};

export interface ProviderClient {
  complete(input: {
    model: string;
    messages: ChatMessage[];
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ text: string; usage: TokenUsage }>;
  embed(input: { model: string; texts: string[] }): Promise<{ vectors: number[][]; usage: EmbedUsage }>;
}

export type ProviderRegistry = Partial<Record<AiProviderId, ProviderClient>>;

export interface UsageMeter {
  record(usage: {
    tenantId: string;
    provider: AiProviderId;
    model: string;
    kind: "complete" | "embed";
    inputTokens?: number;
    outputTokens?: number;
    tokens?: number;
  }): Promise<void>;
}

// Tenant token budget. remaining() <= 0 blocks the call before any provider cost.
export interface Budget {
  remaining(): number;
}

export interface AuditSink {
  record(entry: { action: string; actorId: string; entityType: string; entityId: string }): Promise<void>;
}

const INVOKE_SCOPE = "ai.invoke";

function authorize(actor: Actor | null | undefined) {
  if (!actor) {
    return { ok: false as const, status: 401 as const, error: { code: "UNAUTHENTICATED", message: "Actor required." } };
  }
  if (!actor.scopes.includes(INVOKE_SCOPE)) {
    return { ok: false as const, status: 403 as const, error: { code: "FORBIDDEN", message: `Requires scope ${INVOKE_SCOPE}.` } };
  }
  return null;
}

function budgetExceeded(budget: Budget | undefined) {
  if (budget && budget.remaining() <= 0) {
    return { ok: false as const, status: 429 as const, error: { code: "AI_BUDGET_EXCEEDED", message: "Tenant AI budget exhausted." } };
  }
  return null;
}

function resolveProvider(config: AiConfig, providers: ProviderRegistry) {
  const client = providers[config.provider];
  if (!client) {
    return {
      error: { ok: false as const, status: 400 as const, error: { code: "AI_PROVIDER_NOT_CONFIGURED", message: `No client for provider ${config.provider} (BYOK key may be unset).` } }
    };
  }
  return { client };
}

function invalidInput(issues: unknown) {
  return { ok: false as const, status: 400 as const, error: { code: "INVALID_AI_INPUT", message: "AI input is invalid.", issues } };
}

const tenantOf = (actor: Actor) => actor.tenantId ?? actor.id;

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1)
});

const completeInputSchema = z.object({
  messages: z.array(messageSchema).min(1),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional()
});

const embedInputSchema = z.object({
  texts: z.array(z.string().min(1)).min(1)
});

export async function complete(
  input: { messages: ChatMessage[]; maxTokens?: number; temperature?: number },
  deps: {
    config: AiConfig;
    providers: ProviderRegistry;
    actor: Actor;
    meter?: UsageMeter;
    budget?: Budget;
    audit?: AuditSink;
  }
) {
  const auth = authorize(deps.actor);
  if (auth) return auth;

  const overBudget = budgetExceeded(deps.budget);
  if (overBudget) return overBudget;

  const parsed = completeInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error.issues);

  const resolved = resolveProvider(deps.config, deps.providers);
  if ("error" in resolved) return resolved.error;

  const result = await resolved.client.complete({
    model: deps.config.completeModel,
    messages: parsed.data.messages,
    maxTokens: parsed.data.maxTokens,
    temperature: parsed.data.temperature
  });

  await deps.meter?.record({
    tenantId: tenantOf(deps.actor),
    provider: deps.config.provider,
    model: deps.config.completeModel,
    kind: "complete",
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens
  });
  await deps.audit?.record({ action: "ai.complete", actorId: deps.actor.id, entityType: "ai_call", entityId: deps.config.provider });

  return {
    ok: true as const,
    status: 200 as const,
    data: { text: result.text, usage: result.usage, provider: deps.config.provider, model: deps.config.completeModel }
  };
}

export async function embed(
  input: { texts: string[] },
  deps: {
    config: AiConfig;
    providers: ProviderRegistry;
    actor: Actor;
    meter?: UsageMeter;
    budget?: Budget;
    audit?: AuditSink;
  }
) {
  const auth = authorize(deps.actor);
  if (auth) return auth;

  const overBudget = budgetExceeded(deps.budget);
  if (overBudget) return overBudget;

  const parsed = embedInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error.issues);

  const resolved = resolveProvider(deps.config, deps.providers);
  if ("error" in resolved) return resolved.error;

  const result = await resolved.client.embed({ model: deps.config.embedModel, texts: parsed.data.texts });

  await deps.meter?.record({
    tenantId: tenantOf(deps.actor),
    provider: deps.config.provider,
    model: deps.config.embedModel,
    kind: "embed",
    tokens: result.usage.tokens
  });
  await deps.audit?.record({ action: "ai.embed", actorId: deps.actor.id, entityType: "ai_call", entityId: deps.config.provider });

  return {
    ok: true as const,
    status: 200 as const,
    data: { vectors: result.vectors, usage: result.usage, provider: deps.config.provider, model: deps.config.embedModel }
  };
}

// ─── Governed AI kit (composition helper, plan 34 step 0) ────────────────────
// One place to wire the governance deps (budget/meter/audit) + provider config
// for a single actor, yielding the closures the dep-free caller modules already
// expect, so every call is authorized, budget-capped, metered, and audited the
// same way:
//   - `complete`/`embed` — the CompleteFn that research / decision /
//     marketing-research's gateway-* bridge adapters take.
//   - `completionClient` — the CompletionClient document-extraction's
//     gemma-normalizer takes.
// The budget SOURCE and meter SINK stay pluggable (helpers below) — a site picks
// concrete ones (e.g. a billing quota, audit-log) without changing this wiring.

// Budget from a remaining-tokens thunk, evaluated per call (before provider cost).
export function budgetFrom(remaining: () => number): Budget {
  return { remaining };
}

// Fixed remaining-token budget — the simplest cap; production passes a dynamic source.
export function staticBudget(remaining: number): Budget {
  return { remaining: () => remaining };
}

// UsageMeter from a sink fn — e.g. billing-subscriptions.recordUsage or a usage table.
export function usageMeter(sink: (usage: Parameters<UsageMeter["record"]>[0]) => unknown): UsageMeter {
  return {
    record: async (usage) => {
      await sink(usage);
    }
  };
}

// AuditSink from a record fn — e.g. audit-log.recordEvent.
export function auditSink(record: (entry: Parameters<AuditSink["record"]>[0]) => unknown): AuditSink {
  return {
    record: async (entry) => {
      await record(entry);
    }
  };
}

export type GovernedAiDeps = {
  config: AiConfig;
  providers: ProviderRegistry;
  actor: Actor;
  budget?: Budget;
  meter?: UsageMeter;
  audit?: AuditSink;
};

// Bind ai-gateway for one actor + governance set. The returned closures are what
// the caller modules inject — they never see config/providers/budget/etc.
export function createGovernedAi(deps: GovernedAiDeps) {
  const governance = {
    config: deps.config,
    providers: deps.providers,
    actor: deps.actor,
    budget: deps.budget,
    meter: deps.meter,
    audit: deps.audit
  };

  // Unambiguous local aliases so the object's own `complete` property below can't
  // shadow the module-level functions in the closures.
  const runComplete = (messages: ChatMessage[], opts?: { maxTokens?: number; temperature?: number }) =>
    complete({ messages, maxTokens: opts?.maxTokens, temperature: opts?.temperature }, governance);
  const runEmbed = (texts: string[]) => embed({ texts }, governance);

  return {
    // Matches CompleteFn: (messages) => Promise<{ok,...}>. Extra opts are optional,
    // so a bridge that calls it with just (messages) works unchanged.
    complete: runComplete,
    embed: runEmbed,

    // Matches document-extraction's CompletionClient. Throws on a governed failure
    // (authz/budget/provider) so the caller's existing error path surfaces it.
    completionClient: {
      async complete(input: { messages: ChatMessage[]; maxTokens?: number; temperature?: number }) {
        const r = await runComplete(input.messages, { maxTokens: input.maxTokens, temperature: input.temperature });
        if (r && "data" in r) {
          return { text: r.data.text, provider: r.data.provider, model: r.data.model };
        }
        const status = r && "status" in r ? r.status : 500;
        const errorCode = r && "error" in r ? r.error.code : "AI_UNKNOWN";
        throw new Error(`ai-gateway complete failed (${status} ${errorCode})`);
      }
    }
  };
}

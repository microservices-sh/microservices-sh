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

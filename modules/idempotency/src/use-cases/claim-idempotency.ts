import { err, ok, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { beforeIdempotencyClaim, onIdempotencyReplay } from "../hooks";
import { idempotencyMeta } from "../meta";
import type { IdempotencyStore } from "../ports";
import { claimIdempotencyInputSchema } from "../schemas";
import type { ClaimIdempotencyInput } from "../schemas";
import type { DomainEvent, IdempotencyRecord } from "../types";

function isExpired(record: IdempotencyRecord, nowIso: string): boolean {
  return record.expiresAt <= nowIso;
}

function isStaleInProgress(record: IdempotencyRecord, nowIso: string): boolean {
  return record.status === "in_progress" && record.lockedUntil !== null && record.lockedUntil <= nowIso;
}

function isTerminal(record: IdempotencyRecord): boolean {
  return record.status === "completed" || record.status === "failed";
}

function hashConflicts(record: IdempotencyRecord, requestHash: string | null | undefined): boolean {
  return Boolean(record.requestHash && requestHash && record.requestHash !== requestHash);
}

function makeRecord(input: ClaimIdempotencyInput, nowMs: number): IdempotencyRecord {
  const ttlMs = input.ttlMs ?? 86_400_000;
  const lockTtlMs = input.lockTtlMs ?? 60_000;
  const nowIso = new Date(nowMs).toISOString();
  return {
    id: "idem_" + crypto.randomUUID().slice(0, 16),
    scope: input.scope,
    key: input.key,
    requestHash: input.requestHash ?? null,
    status: "in_progress",
    response: null,
    error: null,
    metadata: input.metadata ?? {},
    statusCode: null,
    lockedUntil: new Date(nowMs + lockTtlMs).toISOString(),
    expiresAt: new Date(nowMs + ttlMs).toISOString(),
    createdAt: nowIso,
    updatedAt: nowIso,
    completedAt: null
  };
}

function claimedEvent(record: IdempotencyRecord, correlationId: string): DomainEvent {
  return {
    name: "idempotency.claimed",
    correlationId,
    payload: { id: record.id, scope: record.scope, key: record.key, expiresAt: record.expiresAt }
  };
}

function replayedEvent(record: IdempotencyRecord, correlationId: string): DomainEvent {
  return {
    name: "idempotency.replayed",
    correlationId,
    payload: { id: record.id, scope: record.scope, key: record.key, status: record.status }
  };
}

function keyConflictError() {
  return {
    code: "idempotency.KEY_REUSED_WITH_DIFFERENT_REQUEST",
    message: "This idempotency key already belongs to a different request hash."
  };
}

function retryAfterMs(record: IdempotencyRecord, nowMs: number): number | undefined {
  if (!record.lockedUntil) return undefined;
  return Math.max(0, Date.parse(record.lockedUntil) - nowMs);
}

function claimed(record: IdempotencyRecord, correlationId: string, meta: ReturnType<typeof idempotencyMeta>) {
  return ok(201, { action: "claimed" as const, record, replayed: false, event: claimedEvent(record, correlationId) }, meta);
}

function inProgress(record: IdempotencyRecord, meta: ReturnType<typeof idempotencyMeta>, retryAfter?: number) {
  const data = { action: "in_progress" as const, record, replayed: true };
  if (retryAfter === undefined) return ok(202, data, meta);
  return ok(202, { ...data, retryAfterMs: retryAfter }, meta);
}

async function replay(record: IdempotencyRecord, correlationId: string, meta: ReturnType<typeof idempotencyMeta>) {
  await onIdempotencyReplay(record);
  return ok(200, { action: "replayed" as const, record, replayed: true, event: replayedEvent(record, correlationId) }, meta);
}

export async function claimIdempotency(
  input: unknown,
  deps: {
    store: IdempotencyStore;
    now?: () => number;
    correlationId?: string;
    beforeClaimHooks?: ResolvedHook<ClaimIdempotencyInput>[];
  }
) {
  const meta = idempotencyMeta(deps);
  const parsed = claimIdempotencyInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "idempotency.INVALID_CLAIM_INPUT", message: "Idempotency claim input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const local = await beforeIdempotencyClaim(parsed.data);
  if (!local) {
    return err(403, { code: "idempotency.CLAIM_REJECTED", message: "Idempotency claim was rejected by local hooks." }, meta);
  }

  const gated = await runHooks("beforeIdempotencyClaim", local, { correlationId: meta.correlationId }, deps.beforeClaimHooks ?? []);
  if (!gated.ok) return err(gated.status, gated.error, meta);
  const data = gated.value;

  const nowMs = deps.now?.() ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const existing = await deps.store.get(data.scope, data.key);

  if (existing) {
    if (hashConflicts(existing, data.requestHash)) {
      return err(409, keyConflictError(), meta);
    }

    if (isTerminal(existing)) {
      return replay(existing, meta.correlationId, meta);
    }

    if (isExpired(existing, nowIso) || isStaleInProgress(existing, nowIso)) {
      const replacement = makeRecord(data, nowMs);
      const replaced = await deps.store.replace(replacement, existing.updatedAt);
      if (replaced) {
        return claimed(replacement, meta.correlationId, meta);
      }
      const current = await deps.store.get(data.scope, data.key);
      if (current && isTerminal(current)) {
        return replay(current, meta.correlationId, meta);
      }
      return inProgress(current ?? existing, meta);
    }

    return inProgress(existing, meta, retryAfterMs(existing, nowMs));
  }

  const record = makeRecord(data, nowMs);
  try {
    await deps.store.insert(record);
  } catch (e) {
    const raced = await deps.store.get(data.scope, data.key);
    if (raced) {
      if (hashConflicts(raced, data.requestHash)) {
        return err(409, keyConflictError(), meta);
      }
      if (isTerminal(raced)) return replay(raced, meta.correlationId, meta);
      return inProgress(raced, meta);
    }
    throw e;
  }

  return claimed(record, meta.correlationId, meta);
}

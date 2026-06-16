import { err, ok } from "@microservices-sh/connection-contract";
import { afterIdempotencyComplete } from "../hooks";
import { mergeMetadata } from "../metadata";
import { idempotencyMeta } from "../meta";
import type { IdempotencyStore } from "../ports";
import { completeIdempotencyInputSchema } from "../schemas";
import type { DomainEvent, IdempotencyRecord } from "../types";

function completedEvent(record: IdempotencyRecord, correlationId: string): DomainEvent {
  return {
    name: "idempotency.completed",
    correlationId,
    payload: { id: record.id, scope: record.scope, key: record.key, statusCode: record.statusCode }
  };
}

export async function completeIdempotency(
  input: unknown,
  deps: { store: IdempotencyStore; now?: () => number; correlationId?: string }
) {
  const meta = idempotencyMeta(deps);
  const parsed = completeIdempotencyInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "idempotency.INVALID_COMPLETE_INPUT", message: "Idempotency completion input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const existing = await deps.store.get(parsed.data.scope, parsed.data.key);
  if (!existing) {
    return err(404, { code: "idempotency.RECORD_NOT_FOUND", message: "No idempotency record exists for this scope/key." }, meta);
  }
  if (existing.status === "completed") {
    return ok(200, { record: existing, alreadyCompleted: true }, meta);
  }
  if (existing.status === "failed") {
    return err(409, { code: "idempotency.ALREADY_FAILED", message: "A failed idempotency record cannot be completed." }, meta);
  }

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const record: IdempotencyRecord = {
    ...existing,
    status: "completed",
    response: parsed.data.response,
    error: null,
    metadata: mergeMetadata(existing.metadata, parsed.data.metadata),
    statusCode: parsed.data.statusCode,
    lockedUntil: null,
    updatedAt: nowIso,
    completedAt: nowIso
  };
  await deps.store.update(record);
  await afterIdempotencyComplete(record);
  return ok(200, { record, alreadyCompleted: false, event: completedEvent(record, meta.correlationId) }, meta);
}

import { err, ok } from "@microservices-sh/connection-contract";
import { afterIdempotencyFail } from "../hooks";
import { mergeMetadata } from "../metadata";
import { idempotencyMeta } from "../meta";
import type { IdempotencyStore } from "../ports";
import { failIdempotencyInputSchema } from "../schemas";
import type { DomainEvent, IdempotencyRecord } from "../types";

function failedEvent(record: IdempotencyRecord, correlationId: string): DomainEvent {
  return {
    name: "idempotency.failed",
    correlationId,
    payload: { id: record.id, scope: record.scope, key: record.key, statusCode: record.statusCode }
  };
}

export async function failIdempotency(
  input: unknown,
  deps: { store: IdempotencyStore; now?: () => number; correlationId?: string }
) {
  const meta = idempotencyMeta(deps);
  const parsed = failIdempotencyInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "idempotency.INVALID_FAIL_INPUT", message: "Idempotency failure input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const existing = await deps.store.get(parsed.data.scope, parsed.data.key);
  if (!existing) {
    return err(404, { code: "idempotency.RECORD_NOT_FOUND", message: "No idempotency record exists for this scope/key." }, meta);
  }
  if (existing.status === "failed") {
    return ok(200, { record: existing, alreadyFailed: true }, meta);
  }
  if (existing.status === "completed") {
    return err(409, { code: "idempotency.ALREADY_COMPLETED", message: "A completed idempotency record cannot be failed." }, meta);
  }

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const record: IdempotencyRecord = {
    ...existing,
    status: "failed",
    response: null,
    error: parsed.data.error,
    metadata: mergeMetadata(existing.metadata, parsed.data.metadata),
    statusCode: parsed.data.statusCode,
    lockedUntil: null,
    updatedAt: nowIso,
    completedAt: nowIso
  };
  await deps.store.update(record);
  await afterIdempotencyFail(record);
  return ok(200, { record, alreadyFailed: false, event: failedEvent(record, meta.correlationId) }, meta);
}

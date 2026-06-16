import { err, ok } from "@microservices-sh/connection-contract";
import { idempotencyMeta } from "../meta";
import type { IdempotencyStore } from "../ports";
import { pruneExpiredRecordsInputSchema } from "../schemas";
import type { DomainEvent } from "../types";

export async function pruneExpiredRecords(
  input: unknown,
  deps: { store: IdempotencyStore; now?: () => number; correlationId?: string }
) {
  const meta = idempotencyMeta(deps);
  const parsed = pruneExpiredRecordsInputSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return err(400, { code: "idempotency.INVALID_PRUNE_INPUT", message: "Prune input is invalid.", issues: parsed.error.issues }, meta);
  }
  const before = parsed.data.before ?? new Date(deps.now?.() ?? Date.now()).toISOString();
  const pruned = await deps.store.deleteExpired(before, parsed.data.limit);
  const event: DomainEvent = {
    name: "idempotency.expired_pruned",
    correlationId: meta.correlationId,
    payload: { before, pruned }
  };
  return ok(200, { before, pruned, event }, meta);
}

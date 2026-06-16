import { err, ok } from "@microservices-sh/connection-contract";
import { idempotencyMeta } from "../meta";
import type { IdempotencyStore } from "../ports";
import { getIdempotencyRecordInputSchema } from "../schemas";

export async function getIdempotencyRecord(
  input: unknown,
  deps: { store: IdempotencyStore; correlationId?: string }
) {
  const meta = idempotencyMeta(deps);
  const parsed = getIdempotencyRecordInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "idempotency.INVALID_GET_INPUT", message: "Idempotency lookup input is invalid.", issues: parsed.error.issues }, meta);
  }
  const record = await deps.store.get(parsed.data.scope, parsed.data.key);
  if (!record) return err(404, { code: "idempotency.RECORD_NOT_FOUND", message: "No idempotency record exists for this scope/key." }, meta);
  return ok(200, { record }, meta);
}

import { recordEvent } from "./record-event";
import { verifyEnvelope } from "../envelope";
import type { AuditEventStore } from "../ports";
import type { EventEnvelope } from "../types";

// Queue consumer entry point (plans/24 layer 3). Verifies the signed envelope's
// origin, then records it. When no secret is configured, signature checking is
// skipped (local/dev). Never on the synchronous business path.
export async function consumeEvent(
  envelope: EventEnvelope,
  deps: { auditStore: AuditEventStore; secret?: string; now?: () => number }
) {
  if (deps.secret) {
    const valid = await verifyEnvelope(envelope, deps.secret);
    if (!valid) {
      return { ok: false as const, status: 401 as const, error: { code: "INVALID_ENVELOPE", message: "Event envelope signature is invalid." } };
    }
  }

  return recordEvent(
    {
      eventName: envelope.eventName,
      actorId: envelope.actorId ?? null,
      entityType: envelope.entityType,
      entityId: envelope.entityId,
      source: envelope.source,
      payload: envelope.payload
    },
    { auditStore: deps.auditStore, now: deps.now }
  );
}

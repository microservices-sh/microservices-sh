import { redactAuditPayload } from "../hooks";
import { recordEventInputSchema } from "../schemas";
import type { AuditEventStore } from "../ports";
import type { AuditEvent } from "../types";

// Append a single audit record. Universal sink: accepts any domain event name.
export async function recordEvent(input: unknown, deps: { auditStore: AuditEventStore; now?: () => number }) {
  const parsed = recordEventInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: { code: "INVALID_AUDIT_INPUT", message: "Audit event input is invalid.", issues: parsed.error.issues }
    };
  }

  const redacted = await redactAuditPayload(parsed.data);
  const event: AuditEvent = {
    id: "aud_" + crypto.randomUUID().slice(0, 16),
    eventName: redacted.eventName,
    actorId: redacted.actorId ?? null,
    entityType: redacted.entityType ?? null,
    entityId: redacted.entityId ?? null,
    source: redacted.source ?? null,
    payload: redacted.payload,
    createdAt: new Date(deps.now?.() ?? Date.now()).toISOString()
  };
  await deps.auditStore.append(event);

  return { ok: true as const, status: 201 as const, data: { id: event.id, eventName: event.eventName } };
}

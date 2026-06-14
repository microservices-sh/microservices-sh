import { listEventsFilterSchema } from "../schemas";
import type { AuditEventStore } from "../ports";

// Admin read of the audit trail. Requires the audit.read scope at the route layer.
export async function listEvents(input: unknown, deps: { auditStore: AuditEventStore }) {
  const parsed = listEventsFilterSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: { code: "INVALID_AUDIT_FILTER", message: "Audit filter is invalid.", issues: parsed.error.issues }
    };
  }
  const events = await deps.auditStore.list(parsed.data);
  return { ok: true as const, status: 200 as const, data: { events } };
}

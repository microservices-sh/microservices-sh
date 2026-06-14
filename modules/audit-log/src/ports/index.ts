import type { AuditEvent, AuditEventFilter } from "../types";

export interface AuditEventStore {
  // Append-only: audit records are never updated or deleted.
  append(event: AuditEvent): Promise<void>;
  list(filter: AuditEventFilter): Promise<AuditEvent[]>;
}

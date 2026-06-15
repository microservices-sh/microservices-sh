export interface AuditEvent {
  id: string;
  eventName: string;
  actorId: string | null;
  entityType: string | null;
  entityId: string | null;
  source: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AuditEventFilter {
  entityType?: string;
  entityId?: string;
  eventName?: string;
  limit?: number;
}

// Envelope wrapping a domain event delivered over a queue (plans/24 layer 3).
export interface EventEnvelope {
  eventName: string;
  entityType: string;
  entityId: string;
  source: string;
  actorId?: string | null;
  correlationId?: string | null;
  payload: Record<string, unknown>;
  signature?: string;
}

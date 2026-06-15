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

export function signEnvelope(envelope: EventEnvelope, secret: string): Promise<EventEnvelope>;
export function verifyEnvelope(envelope: EventEnvelope, secret: string): Promise<boolean>;

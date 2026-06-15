export interface WebhookEndpoint {
  id: string;
  url: string;
  eventNames: string[]; // empty array means "all events"
  secret: string; // per-endpoint signing secret
  active: boolean;
  createdAt: string;
}

export type DeliveryStatus = "delivered" | "failed";

export interface DeliveryAttempt {
  id: string;
  endpointId: string;
  eventName: string;
  status: DeliveryStatus;
  statusCode: number | null;
  error: string | null;
  createdAt: string;
}

export interface DeliveryFilter {
  endpointId?: string;
  status?: DeliveryStatus;
  limit?: number;
}

// A domain event to fan out to external endpoints.
export interface OutboundEvent {
  eventName: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}

// Response from the HttpClient port.
export interface HttpResponse {
  status: number;
  ok: boolean;
}

// A domain event this module emits. correlationId is threaded from the
// triggering request/source event so downstream consumers can stitch the trace.
export interface DomainEvent {
  name: string;
  correlationId: string;
  payload: Record<string, unknown>;
}

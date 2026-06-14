import type { DeliveryAttempt, DeliveryFilter, HttpResponse, WebhookEndpoint } from "../types";

// Registry of external endpoints. Each endpoint holds its own signing secret.
export interface WebhookEndpointStore {
  insert(endpoint: WebhookEndpoint): Promise<void>;
  list(): Promise<WebhookEndpoint[]>;
  // Active endpoints whose subscription matches the given event name (an empty
  // subscription list means "all events").
  listMatching(eventName: string): Promise<WebhookEndpoint[]>;
}

// Append-only log of delivery attempts.
export interface DeliveryLogStore {
  append(attempt: DeliveryAttempt): Promise<void>;
  list(filter: DeliveryFilter): Promise<DeliveryAttempt[]>;
}

// Outbound HTTP boundary so tests can inject a fake client (no real network).
export interface HttpClient {
  post(url: string, body: string, headers: Record<string, string>): Promise<HttpResponse>;
}

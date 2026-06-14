import type { WebhookEndpointStore } from "../ports";
import type { WebhookEndpoint } from "../types";

function rowToEndpoint(row: Record<string, unknown>): WebhookEndpoint {
  return {
    id: String(row.id),
    url: String(row.url),
    eventNames: JSON.parse(String(row.event_names ?? "[]")) as string[],
    secret: String(row.secret),
    active: Number(row.active) === 1,
    createdAt: String(row.created_at)
  };
}

export function createD1WebhookEndpointStore(db: D1Database): WebhookEndpointStore {
  return {
    async insert(endpoint) {
      await db
        .prepare(
          "INSERT INTO webhook_endpoints (id, url, event_names, secret, active, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(
          endpoint.id,
          endpoint.url,
          JSON.stringify(endpoint.eventNames),
          endpoint.secret,
          endpoint.active ? 1 : 0,
          endpoint.createdAt
        )
        .run();
    },

    async list() {
      const result = await db
        .prepare("SELECT * FROM webhook_endpoints ORDER BY created_at DESC")
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToEndpoint);
    },

    async listMatching(eventName) {
      const result = await db
        .prepare("SELECT * FROM webhook_endpoints WHERE active = 1")
        .all<Record<string, unknown>>();
      return (result.results ?? [])
        .map(rowToEndpoint)
        .filter((endpoint) => endpoint.eventNames.length === 0 || endpoint.eventNames.includes(eventName));
    }
  };
}

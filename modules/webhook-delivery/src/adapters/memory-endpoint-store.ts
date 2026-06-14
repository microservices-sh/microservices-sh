import type { WebhookEndpointStore } from "../ports";
import type { WebhookEndpoint } from "../types";

export function createMemoryWebhookEndpointStore(): WebhookEndpointStore {
  const endpoints: WebhookEndpoint[] = [];

  return {
    async insert(endpoint) {
      endpoints.push({ ...endpoint });
    },

    async list() {
      return endpoints.map((endpoint) => ({ ...endpoint }));
    },

    async listMatching(eventName) {
      return endpoints
        .filter((endpoint) => endpoint.active)
        .filter((endpoint) => endpoint.eventNames.length === 0 || endpoint.eventNames.includes(eventName))
        .map((endpoint) => ({ ...endpoint }));
    }
  };
}

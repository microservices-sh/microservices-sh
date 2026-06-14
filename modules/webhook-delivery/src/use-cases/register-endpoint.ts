import { registerEndpointInputSchema } from "../schemas";
import { generateEndpointSecret } from "../signing";
import type { WebhookEndpointStore } from "../ports";
import type { WebhookEndpoint } from "../types";

// Register an external endpoint. Generates a per-endpoint signing secret and
// returns it ONCE — it is stored for signature verification but never returned
// again. Requires webhook.write at the route layer.
export async function registerEndpoint(
  input: unknown,
  deps: { endpointStore: WebhookEndpointStore; now?: () => number }
) {
  const parsed = registerEndpointInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: { code: "INVALID_ENDPOINT_INPUT", message: "Endpoint input is invalid.", issues: parsed.error.issues }
    };
  }

  const secret = generateEndpointSecret();
  const endpoint: WebhookEndpoint = {
    id: "whe_" + crypto.randomUUID().slice(0, 16),
    url: parsed.data.url,
    eventNames: parsed.data.eventNames,
    secret,
    active: true,
    createdAt: new Date(deps.now?.() ?? Date.now()).toISOString()
  };
  await deps.endpointStore.insert(endpoint);

  // Return the raw secret exactly once.
  return {
    ok: true as const,
    status: 201 as const,
    data: { id: endpoint.id, url: endpoint.url, eventNames: endpoint.eventNames, secret }
  };
}

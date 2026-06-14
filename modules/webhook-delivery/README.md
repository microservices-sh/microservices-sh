# Webhook Delivery Module

The outbound mirror of the internal event bus (see
`plans/24-service-topology-and-auth-comms.md`, External Integration / step 9).
When the consuming app is external (not on our Cloudflare account), internal
events cannot reach it — this module POSTs HMAC-signed events to the tenant's
registered endpoint.

## What it does

- **Registers** an external endpoint (`registerEndpoint`, `webhook.write`),
  generating a per-endpoint signing secret returned once.
- **Delivers** a domain event (`deliverEvent`): for each active matching endpoint,
  HMAC-signs the JSON body with the endpoint secret, POSTs it via an injected
  `HttpClient` with `X-Signature` + `X-Idempotency-Id` headers, logs the attempt,
  and emits `webhook.delivered` / `webhook.failed`. Non-2xx is treated as failed.
- **Lists** delivery attempts (`listDeliveries`, `webhook.read`).

## Surface

| Use case | Scope | Purpose |
|----------|-------|---------|
| `registerEndpoint` | `webhook.write` | Register an endpoint, return its signing secret once |
| `deliverEvent` | internal (queue) | Fan a signed event out to matching endpoints |
| `listDeliveries` | `webhook.read` | Read the delivery log |

`signPayload` / `verifyPayload` (HMAC-SHA256) are exported so external receivers
and tests can verify the signature.

## Deps (ports)

- `WebhookEndpointStore` — `createD1WebhookEndpointStore(db)` / `createMemoryWebhookEndpointStore()`.
- `DeliveryLogStore` — `createD1DeliveryLog(db)` / `createMemoryDeliveryLog()`.
- `HttpClient` — `createFetchHttpClient()` (real network) / `createMemoryHttpClient(respond?)` (tests, no network).

## Security notes

- Sink module, approval risk `high`: migrations, external side-effects, and
  production deploy are approval-gated.
- Never make real network calls in tests — inject `createMemoryHttpClient()`.
- Every outbound body is HMAC-signed with the per-endpoint secret; the receiver
  verifies `X-Signature` before trusting it.

# Gateway Module

The public trust boundary for auth-gated apps (see
`plans/24-service-topology-and-auth-comms.md`). The gateway is the only Worker with
a public URL; everything behind it is reached over private service bindings.

## What it does

- **Authenticates** inbound machine-to-machine callers by API key (SHA-256 hashed
  at rest; raw key shown once at creation).
- **Rate-limits** per API key (fixed window).
- **Narrows scopes** — an issued token can never exceed the API key's grant.
- **Exchanges** the API key for a short-lived token by delegating to `auth`. The
  gateway never signs; it calls the auth module/service via a `TokenMinter`.

It holds no business data: only `api_keys` (D1) and rate-limit counters (KV).

## Surface

| Use case | Scope | Purpose |
|----------|-------|---------|
| `issueToken` | public (API key authenticates) | Exchange an API key for a scoped token |
| `verifyApiKey` | internal | Resolve a key to a principal |
| `createApiKey` | `gateway.admin` | Mint a new API key (returns raw key once) |

## Deps (ports)

- `ApiKeyStore` — D1 (`createD1ApiKeyStore`) or memory.
- `RateLimitStore` — KV (`createKvRateLimitStore`) or memory.
- `TokenMinter` — `createLocalTokenMinter({ signingKeyStore })` for embedded mode,
  or `createBindingTokenMinter(authBinding, callerToken)` for service mode.

## Flow (inbound exchange)

```
external app --API key--> issueToken
  verifyApiKey -> principal (subject, workspace, project, scopes)
  rate limit (per key) -> 429 if exceeded
  scope narrowing -> 403 if requested > granted
  TokenMinter.mint -> short-lived token from auth
  emit gateway.token_issued
```

## Security notes

- Store only the API key hash; never log raw keys or issued tokens.
- Treat migrations, API-key management, and public exposure as approval-gated.
- KV rate limiting is approximate (eventually consistent); use a Durable Object
  for strict per-key limits.

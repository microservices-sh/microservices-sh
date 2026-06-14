# Agent Guide: Gateway Module

Read `module.json`, `llms.txt`, `plans/24-service-topology-and-auth-comms.md`, and
`src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral. Do not import SvelteKit, Hono, or app route code.
2. Put persistence behind `ApiKeyStore` / `RateLimitStore`; keep D1 in
   `src/adapters/d1-api-key-store.ts` and KV in `src/adapters/kv-rate-limit-store.ts`.
3. The gateway never signs tokens. Minting goes through the `TokenMinter` port,
   backed by `auth`. Keep `requires: ["auth"]`.
4. Store only the API key hash. Never log raw keys or issued tokens.
5. Issued token scopes must never exceed the API key grant (`issue-token.ts`).
6. Treat migrations, API-key management, public exposure, and production deploy as
   approval-gated.
7. Prefer config/hooks before overlays or forks.
8. Run `pnpm --filter @microservices-sh/gateway build` and
   `pnpm spec:check -- module modules/gateway` after edits.

# Agent Guide: Auth Module

Read `module.json`, `llms.txt`, `plans/24-service-topology-and-auth-comms.md`, and
`src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral. Do not import SvelteKit, Hono, or app route code.
2. Put persistence behind `SigningKeyStore`; put D1 behavior in `src/adapters/d1-signing-key-store.ts`.
3. Keep tokens asymmetric (EdDSA). Do not switch to a shared HS256 secret.
4. Treat migrations, secrets, signing-key rotation, and production deploy as approval-gated.
5. The private signing key must never be logged or returned to an agent transcript.
6. `src/rpc.ts` is the neutral RPC contract descriptor consumed by codegen — keep
   method names and `scope` values in sync with `module.json` `rpc` and `permissions`.
7. Prefer config/hooks before overlays or forks.
8. Run `pnpm --filter @microservices-sh/auth build` and `pnpm spec:check -- module modules/auth` after edits.

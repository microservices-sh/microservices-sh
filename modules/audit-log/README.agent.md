# Agent Guide: Audit Log Module

Read `module.json`, `llms.txt`, `plans/24-service-topology-and-auth-comms.md`, and
`src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral. Do not import SvelteKit, Hono, or app route code.
2. Put persistence behind `AuditEventStore`; keep D1 in `src/adapters/d1-audit-store.ts`.
3. Keep the table append-only — never add update or delete paths.
4. This is a pure sink: it must not be called on the synchronous business path; it
   consumes events via the queue (`consumeEvent`) or out-of-band recording.
5. Verify signed envelopes (`verifyEnvelope`) before recording when a secret is set.
6. Use `redactAuditPayload` to remove sensitive fields; never log raw PII.
7. Treat migrations, PII redaction, and production deploy as approval-gated.
8. Run `pnpm --filter @microservices-sh/audit-log build` and
   `pnpm spec:check -- module modules/audit-log` after edits.

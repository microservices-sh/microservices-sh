# Email Use Cases

Use cases are framework-neutral domain operations. Keep web framework request/response mapping in templates or app adapters.

`send-email.ts` validates input, applies hooks, calls the configured provider, records the delivery attempt, emits `email.queued` or `email.failed`, and returns a module result.

Retrying callers should provide `idempotencyKey`; the Resend adapter forwards it as `Idempotency-Key`.

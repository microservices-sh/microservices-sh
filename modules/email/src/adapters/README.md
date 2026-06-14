# Email Adapters

Adapters translate module ports to runtime-specific storage or provider APIs.

- `resend-email-provider.ts` sends through the Resend REST API using `fetch`.
- `d1-email-repository.ts` persists delivery attempts and events in Cloudflare D1.
- `memory-email-repository.ts` supports tests, demos, and generated preview apps.

Do not add committed provider credentials. The Resend adapter expects the caller to pass a runtime secret.

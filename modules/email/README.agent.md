# Email Module Agent Guide

Use this module through `@microservices-sh/email`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

Provider integration:

- Use `createResendEmailProvider` from `@microservices-sh/email/adapters/resend`.
- Pass `env.RESEND_API_KEY`; never inline an API key or place it in committed config.
- Set a real `User-Agent` for the generated app.
- Pass `idempotencyKey` for workflow-triggered or retryable emails.
- Use `testMode: true` only for local/generated preview flows.

Review requirements:

- Production sender changes require approval.
- New email templates must be reviewed for PII and unsubscribe/compliance needs.
- Any module that sends email from background jobs should document retry and idempotency behavior.

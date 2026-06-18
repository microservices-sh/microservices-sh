# Email Module Agent Guide

Use this module through `@microservices-sh/email`.

Safe first actions:

1. Read `module.json`.
2. Read `setup.schema.json` before collecting provider config or secrets.
3. Read `llms.txt`.
4. Inspect `src/index.ts` exports.
5. Run `pnpm check:spec`.
6. Run `pnpm build` after source edits.

Provider integration:

- Use `createResendEmailProvider` from `@microservices-sh/email/adapters/resend`.
- Pass `env.RESEND_API_KEY`; never inline an API key or place it in committed config.
- Store setup config and secrets according to `setup.schema.json`: config is safe
  for `microservices.config.json`, secrets go only to the runtime secret store.
- Set a real `User-Agent` for the generated app.
- Pass `idempotencyKey` for workflow-triggered or retryable emails.
- Use `testMode: true` only for local/generated preview flows.

Review requirements:

- Production sender changes require approval.
- New email templates must be reviewed for PII and unsubscribe/compliance needs.
- Any module that sends email from background jobs should document retry and idempotency behavior.

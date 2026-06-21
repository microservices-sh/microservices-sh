# SMS Campaigns Module Agent Guide

Use this module through `@microservices-sh/sms-campaigns`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

Operational rules:

- Never dispatch SMS directly from route code; call `dispatchSmsCampaign` with an approved `SmsProvider`.
- Confirm consent and audience filters before creating or sending campaigns.
- Keep raw provider credentials out of D1. Use `apiKeyRef`/secret references.
- Treat phone numbers, names, tags, and delivery logs as PII.
- Delivery callbacks should call `recordSmsDelivery` with the provider message id so replays update the existing log.
- Do not add provider calls, secrets, migrations, imports, or production deploy behavior without approval.

# Idempotency Module Agent Guide

Use this module through `@microservices-sh/idempotency`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm test`.
5. Run `pnpm check:spec`.
6. Run `pnpm build` after source edits.

Core workflow:

```ts
const claim = await claimIdempotency(
  { scope: "payment.intent", key: idempotencyKey, requestHash },
  { store }
);

if (claim.ok && claim.data.action === "claimed") {
  const payment = await createPayment();
  await completeIdempotency(
    { scope: "payment.intent", key: idempotencyKey, response: { paymentId: payment.id }, statusCode: 201 },
    { store }
  );
}
```

Rules:

- Never run the protected side effect unless claim returns `action: "claimed"`.
- Treat `action: "replayed"` as the stored terminal result.
- Treat `action: "in_progress"` as a wait/retry response.
- Always use a stable scope such as `webhook.stripe`, `forms.submit`, or
  `invoice.issue`.
- Use `requestHash` when the original payload is available.
- Do not store secrets in `metadata`, `response`, or `error`.

Do not add provider calls, secrets, queues, or production deploy behavior without
approval.

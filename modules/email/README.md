# Email Module

Status: `available`

Transactional email module with provider-neutral ports and a Resend HTTP adapter.

## Public Surface

```ts
import { sendEmail } from "@microservices-sh/email";
import { createResendEmailProvider } from "@microservices-sh/email/adapters/resend";
import { createD1EmailRepository } from "@microservices-sh/email/adapters/d1";

const provider = createResendEmailProvider({
  apiKey: env.RESEND_API_KEY,
  userAgent: "my-app/1.0"
});

const result = await sendEmail(
  {
    from: "Acme <hello@example.com>",
    to: "customer@example.com",
    subject: "Welcome",
    html: "<p>Your account is ready.</p>",
    idempotencyKey: "welcome-user-123"
  },
  {
    provider,
    emailRepository: createD1EmailRepository(env.DB)
  }
);
```

## Ownership Boundary

The module owns domain behavior, schemas, hooks, events, permissions, resources, and migrations for `email`.

Templates own app shell, route adapters, UI layout, and framework-specific response mapping.

## Resend Setup

Set `RESEND_API_KEY` as a runtime secret. Do not commit it in config, fixtures, generated apps, or examples.

For Cloudflare Workers:

```bash
wrangler secret put RESEND_API_KEY
```

Resend requires a verified sending domain for production recipients. Keep `config.defaultFrom` empty until the app owner chooses the verified sender address, or pass `from` per send call.

## Provider Contract

The module calls Resend through `fetch` instead of the Node SDK so the same module works in Cloudflare Workers and plain Node runtimes. The adapter sends:

- `POST https://api.resend.com/emails`
- `Authorization: Bearer <RESEND_API_KEY>`
- `User-Agent`
- `Idempotency-Key` when `idempotencyKey` is provided

Supported payload fields are `from`, `to`, `cc`, `bcc`, `replyTo`, `subject`, `html`, `text`, `headers`, `attachments`, `tags`, and `template`.

## Review Notes

Production use requires approval because this module creates an external side effect. Reviewers should check sender domain ownership, idempotency strategy, PII in events, and whether the generated app records delivery attempts with the D1 repository.

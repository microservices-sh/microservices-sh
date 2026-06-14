# Email Module

Status: `available`

Transactional email module with provider-neutral ports and Resend and StackSuite (AWS SES) HTTP adapters.

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

## StackSuite Email Service Setup

The `adapters/stacksuite` provider sends through the StackSuite email service
(`/home/ubuntu/Project/stacksuite/email-service`), an AWS Lambda + SES gateway
fronted by API Gateway. Use this provider when the app should send through the
shared, SES-verified `stacksuite.dev` sending domain.

```ts
import { sendEmail } from "@microservices-sh/email";
import { createStacksuiteEmailProvider } from "@microservices-sh/email/adapters/stacksuite";
import { createD1EmailRepository } from "@microservices-sh/email/adapters/d1";

const provider = createStacksuiteEmailProvider({
  apiKey: env.EMAIL_SERVICE_API_KEY,
  apiBaseUrl: env.EMAIL_SERVICE_URL, // https://{api-id}.execute-api.{region}.amazonaws.com/production
  userAgent: "my-app/1.0"
});

const result = await sendEmail(
  {
    from: "Acme <notifications@stacksuite.dev>",
    to: "customer@example.com",
    subject: "Welcome",
    html: "<p>Your account is ready.</p>"
  },
  { provider, emailRepository: createD1EmailRepository(env.DB) }
);
```

Set the runtime secret and URL (do not commit either):

```bash
wrangler secret put EMAIL_SERVICE_API_KEY   # API Gateway X-Api-Key
# EMAIL_SERVICE_URL is a public var in wrangler.jsonc vars
```

Fetch the API key from the deployed service stack:

```bash
aws cloudformation describe-stacks \
  --stack-name email-service-production --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiKeyId`].OutputValue' --output text
aws apigateway get-api-key --api-key <KEY_ID> --include-value \
  --query 'value' --output text
```

### StackSuite Provider Contract

The adapter sends through `fetch`:

- `POST {EMAIL_SERVICE_URL}/send`
- `X-Api-Key: <EMAIL_SERVICE_API_KEY>`
- `User-Agent`

Request body maps from `SendEmailInput`: `to`, `subject`, `text`→`body`, `html`,
`replyTo`, and `from` split into `fromName`/`fromEmail`. The service does **not**
support `cc`, `bcc`, `headers`, `attachments`, `tags`, or `template` — those
fields are dropped by the adapter. Success returns `{ success: true, messageId }`;
the adapter also treats `{ success: false }` on a 200 as a failure.

### AWS SES Domain Verification

Sending through this provider requires the sender domain to be a verified SES
identity in the email service's region (`ap-northeast-1` for staging/production):

1. AWS SES Console → **Verified identities** → **Create identity** → **Domain** →
   `stacksuite.dev` (or your own domain).
2. Enable **Easy DKIM**; add the three `CNAME` records SES returns to DNS.
3. Request **production access** to leave the SES sandbox (24–48h approval).
4. Optional: add a `_dmarc` TXT record for deliverability.

Until the domain is verified and out of the sandbox, SES only delivers to
verified test recipients and the service returns a 500 `SES error`.

## Review Notes

Production use requires approval because this module creates an external side effect. Reviewers should check sender domain ownership, idempotency strategy, PII in events, and whether the generated app records delivery attempts with the D1 repository.

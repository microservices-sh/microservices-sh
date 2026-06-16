# Provider Map

## Providers And Modules

| Provider Surface | Owning Module(s) | Typical Secrets/Bindings |
| --- | --- | --- |
| Stripe payments | `payment` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, D1 |
| Stripe subscriptions | `billing-subscriptions`, often `payment` | Stripe secrets, D1 |
| Transactional email | `email` | `RESEND_API_KEY` or `EMAIL_SERVICE_API_KEY`, D1 |
| Outbound webhooks | `webhook-delivery` | endpoint signing secret, D1 |
| Google Calendar | `calendar-google` | OAuth client/refresh tokens, D1 |
| File uploads/media | `file-media` | R2 bucket binding, D1 |
| Image generation | `image-generation` | provider API key, R2 bucket, D1 |
| Ads monitoring | `ads-manager` | upstream connector entitlement/API token, D1 |

## Provider Safety Defaults

- Use test/sandbox mode first.
- Put provider calls behind module ports/adapters.
- Keep callbacks/webhooks signed and idempotent.
- Store generated files/images in tenant-scoped R2 keys.
- Log provider failures without leaking secret values.
- Make production side effects approval-gated.

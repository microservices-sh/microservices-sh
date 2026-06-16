# Production Readiness Checklist

## Trust Boundary

- Auth/session cookies are secure, scoped, and checked at every private route.
- API keys, service tokens, scopes, and gateway checks cannot be bypassed.
- Admin CRUD is permission-scoped and does not expose arbitrary tables.
- Tenant id, workspace id, org id, or customer id is enforced in every query that needs isolation.

## Sensitive Data

- PII fields are intentional and documented.
- Customer, booking, invoice, file, and audit routes return only allowed records.
- Logs, telemetry, errors, and emails do not leak secrets or private records.
- Audit-log redaction/export rules are explicit.

## Provider And Money

- Stripe/payment/billing paths use test mode until production approval.
- Webhook verification is signed, idempotent, and replay-safe.
- Email sender/domain changes are approved; no production email blast in tests.
- Calendar, ads, image, and file providers are scoped and have clear rollback.

## Resources And Deploy

- D1 migrations are reviewed and tested locally.
- KV/R2/Queue bindings are present in `wrangler.jsonc` and deploy plan.
- Secrets are configured by name, not pasted into chat or source.
- Preview deploy, provision, migrate, upload, and production activation are plan-first.
- Smoke checks cover the main user path and at least one private/admin path.

## Evidence

Capture commands run, outputs summarized, and exact files inspected. A readiness review without evidence is not a go/no-go review.

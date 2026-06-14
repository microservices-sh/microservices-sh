# Booking Ports

Ports define dependency interfaces used by booking use cases.

Planned ports:

- `BookingRepository`
- `AuditWriter`
- `DomainEventBus`
- `PaymentProvider`
- `NotificationProvider`
- `Clock`
- `IdGenerator`

Adapters implement these ports for Cloudflare D1, KV, Stripe, email providers, and tests.

Customer create/list/read behavior is provided by `@microservices-sh/customer`.

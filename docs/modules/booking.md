# Booking Module

Status: `available`

Class: `core`

Mount: `/bookings`

## Purpose

The Booking module manages bookable services, availability checks, booking creation, confirmation, cancellation, and booking lifecycle events.

## When To Use

- Use for service businesses, studios, consultants, clinics, classes, and appointment systems.
- Use when an app needs configurable booking rules and customer booking history.

## When Not To Use

- Do not use for complex travel inventory, hotel room management, or enterprise workforce scheduling in the MVP.
- Do not use for multi-location recurring schedules until those extensions are implemented.

## Dependencies

| Dependency | Required | Reason |
|------------|----------|--------|
| `auth` | Yes | Actor identity and permissions. |
| `customer` | Yes | Every booking belongs to a customer. |
| D1 binding `DB` | Yes | Stores services, bookings, and events. |
| KV binding `CACHE_KV` | Yes | Availability/rate-limit cache where configured. |
| `payment-stripe` | Optional | Deposits and payment status. |
| `email` | Optional | Confirmations and cancellation notices. |
| `audit-log` | Optional | Dedicated mutation audit trail. |

## Runtime And Resources

| Resource | Name | Required | Notes |
|----------|------|----------|-------|
| D1 table | `services` | Yes | Bookable service definitions. |
| D1 table | `bookings` | Yes | Booking records. |
| D1 table | `domain_events` | Yes | Booking lifecycle events. |
| KV | `CACHE_KV` | Yes | Optional availability cache. |
| Queue | `NOTIFICATIONS` | Optional | Async confirmation/reminder work. |

## Secrets And Environment

| Name | Type | Scope | Required | Notes |
|------|------|-------|----------|-------|
| `BOOKING_TIMEZONE` | Var/config | module/env | No | Defaults to app timezone. |
| `BOOKING_MAX_FUTURE_DAYS` | Var/config | module/env | No | Defaults to template config. |

No module-private secret is required for base booking logic.

## Permissions And Approval Gates

| Permission | Purpose |
|------------|---------|
| `booking.read` | Read availability and bookings. |
| `booking.write` | Create, confirm, reschedule, or cancel bookings. |
| `booking.admin` | Manage services and booking rules. |

Risk level: `medium`

Approval required for:

- installing booking tables
- changing cancellation/payment rules in production
- enabling payment or email side effects
- running migrations
- production deployment

## Routes

| Method | Path | Auth | Permission | Purpose |
|--------|------|------|------------|---------|
| `GET` | `/bookings/availability` | Public or required by config | `booking.read` | Return available slots. |
| `POST` | `/bookings` | Public or required by config | `booking.write` | Create a booking. |
| `GET` | `/bookings` | Required | `booking.read` | List bookings for staff/admin. |
| `GET` | `/bookings/:id` | Required | `booking.read` | Read one booking. |
| `POST` | `/bookings/:id/confirm` | Required | `booking.write` | Confirm a pending booking. |
| `POST` | `/bookings/:id/cancel` | Required | `booking.write` | Cancel a booking. |

## Payloads And Responses

### Availability

Request query:

```text
GET /bookings/availability?serviceId=svc_123&date=2026-07-01
```

Response:

```json
{
  "ok": true,
  "slots": [
    {
      "serviceId": "svc_123",
      "startsAt": "2026-07-01T10:00:00.000Z",
      "endsAt": "2026-07-01T11:00:00.000Z",
      "capacityRemaining": 1
    }
  ]
}
```

### Create Booking

Request:

```json
{
  "customerId": "cus_123",
  "serviceId": "svc_123",
  "startsAt": "2026-07-01T10:00:00.000Z",
  "notes": "First visit",
  "depositRequired": true
}
```

Response:

```json
{
  "ok": true,
  "booking": {
    "id": "bok_123",
    "customerId": "cus_123",
    "serviceId": "svc_123",
    "status": "pending",
    "startsAt": "2026-07-01T10:00:00.000Z",
    "endsAt": "2026-07-01T11:00:00.000Z"
  }
}
```

### Cancel Booking

Request:

```json
{
  "reason": "Customer requested cancellation"
}
```

Response:

```json
{
  "ok": true,
  "booking": {
    "id": "bok_123",
    "status": "cancelled"
  }
}
```

## Events

### Emits

| Event | Payload | Purpose |
|-------|---------|---------|
| `booking.created` | `bookingId`, `customerId`, `serviceId`, `startsAt` | Trigger deposit, email, or audit workflows. |
| `booking.confirmed` | `bookingId`, `customerId` | Trigger confirmation email and reminders. |
| `booking.cancelled` | `bookingId`, `reason` | Trigger cancellation email, refund logic, and audit. |

### Consumes

| Event | Action |
|-------|--------|
| `customer.created` | Optionally update booking customer context. |
| `payment.succeeded` | Confirm deposit-paid bookings. |

## Hooks

| Hook | Timing | Input | Output | Purpose |
|------|--------|-------|--------|---------|
| `beforeBookingCreate` | Pre | booking payload, customer, service | modified payload or validation error | Enforce business rules. |
| `calculateAvailability` | Compute | service, date, existing bookings | slot list | Customize availability. |
| `calculateDeposit` | Compute | service, customer, booking | deposit amount/rule | Customize deposit logic. |
| `afterBookingConfirmed` | Post | booking | side effects only | Send notifications or trigger sync. |

## Database Tables

| Table | Purpose |
|-------|---------|
| `services` | Stores bookable services and duration/capacity rules. |
| `bookings` | Stores booking records and status. |
| `domain_events` | Stores booking lifecycle events in MVP generated apps. |

## Customization

Preferred order:

1. Config: service types, durations, lead time, cancellation window, waitlist flag.
2. Hooks: availability, deposit, validation, post-confirmation work.
3. Overlay: custom admin routes or booking views.
4. Fork: recurring booking engine, multi-location capacity, or deep scheduling rules.

## Upgrade Notes

- Availability and deposit customizations should stay in hooks for upgrade safety.
- Direct edits to booking route internals make automated upgrades harder.
- Payment and email side effects should be handled through events, not hidden route calls.

## Failure Modes

| Failure | Cause | Agent Remediation |
|---------|-------|-------------------|
| Slot unavailable | Conflict or capacity exhausted | Return alternative slots from `calculateAvailability`. |
| Customer missing | Invalid `customerId` | Create or select customer before booking. |
| Payment required | Deposit rule enabled | Install/configure `payment-stripe` or disable deposit rule. |
| Notification missing | Email module not installed | Install/configure `email` or disable email side effect. |

## Agent Checklist

- Inspect services and booking rules.
- Confirm public vs authenticated booking flow.
- Confirm cancellation and deposit policy.
- Keep custom availability logic in `calculateAvailability`.
- Run booking create/cancel tests.


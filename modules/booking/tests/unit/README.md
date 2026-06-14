# Booking Module Tests

Two layers, run together with one command:

- **Use-case tests** — drive each use case through the in-memory adapters (fast, offline).
- **D1 adapter test** — runs the real `d1-booking-repository.ts` SQL against an
  in-memory SQLite via Node's built-in `node:sqlite` (no extra dependency). It
  self-skips if `node:sqlite` is unavailable.

```bash
pnpm --filter @microservices-sh/booking test        # one-shot
pnpm --filter @microservices-sh/booking test:watch  # watch mode
```

## Coverage

| Use case          | File                       | Scenarios |
| ----------------- | -------------------------- | --------- |
| `createBooking`   | `create-booking.test.ts`   | happy path, endsAt derivation, clock/id injection, persistence + event, customer upsert/reuse, optional-field defaults, input validation (email, datetime, empty id, name length, non-object), service not-found/inactive, slot conflict, unique-constraint race → 409, non-constraint error rethrow |
| `cancelBooking`   | `cancel-booking.test.ts`   | cancels confirmed booking, frees slot for rebooking, 404 unknown, 409 already-cancelled, bumps `updatedAt` |
| `getAvailability` | `get-availability.test.ts` | valid query echo, overlap marks slot unavailable, malformed date, missing serviceId |
| `getBooking`      | `get-booking.test.ts`      | found, not-found 404 |
| `listBookings`    | `list-bookings.test.ts`    | empty list, sorted by `startsAt` |
| D1 adapter SQL    | `d1-booking-repository.test.ts` | active-only service list, create + join read-back, overlap SQL (exact/partial/adjacent boundary), confirmed-slot unique index on double-book, cancel frees slot, cancel unknown → null, domain + audit event rows, newest-first listing |

`helpers.ts` builds the in-memory dependency bundle (booking + customer repos, a
fixed clock, a deterministic id generator) plus a `validBookingInput` factory.
`d1-harness.ts` builds the SQLite-backed D1 shim + seed data. When you modify the
booking use cases or the D1 adapter for your own app, update or extend these
scenarios to match.

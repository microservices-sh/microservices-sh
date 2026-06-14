# Booking Module Tests

Unit tests for the booking use cases, driven by the in-memory adapters so they
run fast and offline. Run them with:

```bash
pnpm --filter @microservices-sh/booking test        # one-shot
pnpm --filter @microservices-sh/booking test:watch  # watch mode
```

## Coverage

| Use case          | File                       | Scenarios |
| ----------------- | -------------------------- | --------- |
| `createBooking`   | `create-booking.test.ts`   | happy path, endsAt derivation, clock/id injection, persistence + event, customer upsert/reuse, optional-field defaults, input validation (email, datetime, empty id, name length, non-object), service not-found/inactive, slot conflict, unique-constraint race → 409, non-constraint error rethrow |
| `getAvailability` | `get-availability.test.ts` | valid query echo, overlap marks slot unavailable, malformed date, missing serviceId |
| `getBooking`      | `get-booking.test.ts`      | found, not-found 404 |
| `listBookings`    | `list-bookings.test.ts`    | empty list, sorted by `startsAt` |

`helpers.ts` builds the dependency bundle (in-memory booking + customer repos,
a fixed clock, and a deterministic id generator) plus a `validBookingInput`
factory. When you modify the booking use cases for your own app, update or
extend these scenarios to match.

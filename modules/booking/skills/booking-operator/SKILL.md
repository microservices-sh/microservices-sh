---
name: booking-operator
description: Use when operating booking services, availability, customer booking support, or admin booking workflows.
---

# Booking Operator

Before acting:

1. Read `module.json` and confirm `booking` is installed and enabled.
2. Use read tools first: list bookings, inspect details, and check availability.
3. Ask for approval before creating, cancelling, rescheduling, charging, refunding, or messaging a customer.
4. Record important mutations through `audit-log` when available.

Safe defaults:

- Treat booking participants and notes as PII.
- Do not bypass cancellation windows unless the user explicitly approves.
- Prefer draft/hold flows before final confirmation when payment or capacity is involved.

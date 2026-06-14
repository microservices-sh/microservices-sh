# Booking

Status: available
Module ID: `booking`
Mount: `/bookings`

## Summary
Service booking, availability, cancellation windows, confirmation, and booking events.

## Dependencies
- auth
- customer

## Permissions
- booking.read
- booking.write
- booking.admin

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1
- KV

## Hooks
- beforeBookingCreate
- calculateAvailability
- afterBookingConfirmed

## Events
- booking.created
- booking.confirmed
- booking.cancelled
- customer.created
- payment.succeeded

## Approval Gate
Risk: medium

Adding or changing auth, payment, email, webhook, migration, PII, or production deploy behavior requires explicit approval.

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.

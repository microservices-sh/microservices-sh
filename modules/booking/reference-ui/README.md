# Booking Reference UI

Reference UI is optional host-app code. The module owns booking domain behavior; the host owns routing, layout, branding, and component styling.

Admin surface:
- List bookings, inspect booking detail, view availability, and run approved cancel/reschedule actions.
- Gate read views with `booking.read`; gate mutations with `booking.write` or `booking.admin`.

Visitor surface:
- Browse services, show availability, create booking drafts, and resume or cancel bookings when policy allows.
- Use the visitor feature key `spaces`.

Agentic surface:
- Prefer availability lookup and booking detail reads before mutation.
- Require approval before creating, cancelling, rescheduling, charging, or sending customer messages.

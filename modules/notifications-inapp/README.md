# In-App Notifications Module

A per-user in-app notification feed for auth-gated apps. This module owns
**persistence and correct read/unread state**. It is framework-neutral and has
no realtime transport of its own.

## What it does

Each capability targets a failure mode that's easy to get wrong:

- **Per-user targeting (not broadcast).** Every notification is addressed to a
  specific `userId`. There is no "notify all" path — fan-out is one `notify()`
  per recipient. All lists and counts are user-scoped.
- **Read/unread state.** `markRead(ids, userId)` for specific notifications,
  `markAllRead(userId)` to clear the badge, and `getUnreadCount(userId)` for an
  accurate count (computed in the store, not from a paginated list).
- **Polymorphic types.** A `type` discriminator plus a JSON `data` payload, so
  `booking.confirmed`, `payment.received`, and `mention` each carry their own
  shape without changing the schema.
- **Reconnect / missed-delivery catch-up.** `listNotifications` accepts a
  `sinceIso` cursor so a client that reconnects fetches only what it missed.
- **Idempotent notify.** An optional `dedupKey` (unique per user) means the same
  upstream event delivered twice doesn't create duplicate notifications.

## Surface

| Use case | Scope | Purpose |
|----------|-------|---------|
| `notify` | internal / `notifications.write` | Create one user-addressed notification (idempotent on `dedupKey`) |
| `listNotifications` | `notifications.read` | User-scoped feed; supports `unreadOnly`, `limit`, `sinceIso` |
| `getUnreadCount` | `notifications.read` | Accurate unread badge count for a user |
| `markRead` | `notifications.write` | Mark specific ids read (scoped to the user) |
| `markAllRead` | `notifications.write` | Mark all of a user's notifications read |

All use cases return the standard `{ ok, status, data, error }` shape.

## Realtime is the host's job

This module does **not** ship a WebSocket server or Durable Object. The host app
owns the realtime push transport: on `notify()` success it should push the new
notification to any connected socket for that `userId` (e.g. via a Durable
Object keyed by user). This module is the source of truth for what was delivered
and its read state; the socket layer is a delivery optimization. A client that
was offline catches up with `listNotifications({ userId, sinceIso })`.

## Deps

Persistence is behind `NotificationStore` (`src/ports`):
`createD1NotificationStore(db)` for Cloudflare D1, `createMemoryNotificationStore()`
for tests.

## Notes

- Always scope by `userId`; never read or mutate across users.
- Treat migrations and production deploy as approval-gated.

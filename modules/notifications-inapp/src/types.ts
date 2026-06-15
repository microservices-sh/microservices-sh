// A single in-app notification addressed to ONE user.
//
// FAILURE MODE THIS GUARDS AGAINST: agents tend to model notifications as
// broadcasts ("notify all users") or as a single hardcoded shape. Here every
// notification has a `userId` recipient and a polymorphic (`type` + `data`)
// payload, so booking-confirmed / payment-received / mention each carry their
// own shape without changing the table.
export interface Notification {
  id: string;
  // Recipient. There is no "broadcast" notification — fan-out is the caller's
  // job (one notify() per recipient). Lists/counts are always user-scoped.
  userId: string;
  // Discriminator for the polymorphic payload (e.g. "booking.confirmed").
  type: string;
  title: string | null;
  body: string | null;
  // Per-type JSON payload. Its shape depends on `type`; this module does not
  // interpret it.
  data: Record<string, unknown>;
  // ISO timestamp when the user read it, or null while unread.
  readAt: string | null;
  // Optional idempotency key (scoped per user). See notify use case.
  dedupKey: string | null;
  createdAt: string;
}

// A domain event the module emits (e.g. notification.created). correlationId is
// threaded from the use-case Meta so downstream consumers can trace the chain.
export interface DomainEvent {
  name: string;
  correlationId?: string | null;
  payload: Record<string, unknown>;
}

// Filter for the user-scoped feed query. userId is supplied separately (it is
// never optional — see ports), so it is not part of the filter shape.
export interface NotificationListFilter {
  // When true, return only notifications where readAt IS NULL.
  unreadOnly?: boolean;
  limit?: number;
  // Reconnect/catch-up cursor: return notifications created AFTER this ISO
  // timestamp. A client that reconnects passes the createdAt of the last
  // notification it saw to fetch only what it missed.
  sinceIso?: string;
}

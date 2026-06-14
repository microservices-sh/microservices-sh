import type { Notification, NotificationListFilter } from "../types";

// Persistence contract for the in-app notification feed.
//
// EVERY user-facing method takes `userId` explicitly. This is deliberate: it
// makes it impossible to accidentally read or mutate across users (the failure
// mode where one user sees/clears another user's feed). Adapters MUST scope all
// queries by the supplied userId.
export interface NotificationStore {
  // Insert one notification. The notify use case has already resolved
  // idempotency (see recordDedupKey / get-by-dedup); this just persists.
  insert(notification: Notification): Promise<void>;

  // User-scoped feed. Newest first. Honors unreadOnly, limit, and sinceIso
  // (reconnect cursor). Never returns another user's rows.
  listForUser(userId: string, filter: NotificationListFilter): Promise<Notification[]>;

  // Fetch one notification by id, scoped to userId (returns null if it belongs
  // to another user or does not exist).
  get(id: string, userId: string): Promise<Notification | null>;

  // Mark specific ids read for this user. Returns the count actually updated
  // (ids not owned by the user are ignored). Idempotent: already-read rows are
  // left at their original readAt.
  markRead(ids: string[], userId: string): Promise<number>;

  // Mark every unread notification for this user as read. Returns the count
  // updated.
  markAllRead(userId: string): Promise<number>;

  // Accurate count of unread (readAt IS NULL) notifications for this user.
  unreadCount(userId: string): Promise<number>;

  // Idempotency lookup. Returns the existing notification for (userId, dedupKey)
  // if one was already recorded, else null. Used by notify() to avoid creating
  // duplicates for the same upstream event.
  recordDedupKey(userId: string, dedupKey: string): Promise<Notification | null>;
}

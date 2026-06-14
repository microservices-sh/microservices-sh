import { listNotificationsInputSchema } from "../schemas";
import type { NotificationStore } from "../ports";

// User-scoped feed read. ALWAYS scoped to input.userId — there is no path to
// list "all" notifications. Supports:
//  - unreadOnly: only readAt IS NULL rows
//  - sinceIso: reconnect/catch-up cursor; a client that dropped its connection
//    passes the createdAt of the last notification it saw to fetch only what it
//    missed (no full re-sync).
export async function listNotifications(input: unknown, deps: { store: NotificationStore }) {
  const parsed = listNotificationsInputSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: {
        code: "INVALID_NOTIFICATION_FILTER",
        message: "Notification list filter is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const { userId, unreadOnly, limit, sinceIso } = parsed.data;
  const notifications = await deps.store.listForUser(userId, { unreadOnly, limit, sinceIso });

  return { ok: true as const, status: 200 as const, data: { notifications } };
}

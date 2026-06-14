import { unreadCountInputSchema } from "../schemas";
import type { NotificationStore } from "../ports";

// Accurate unread badge count for one user. Counts readAt IS NULL rows in the
// store rather than the length of a (capped, paginated) list — listing with a
// limit would undercount once a user has more unread than the page size.
export async function getUnreadCount(input: unknown, deps: { store: NotificationStore }) {
  const parsed = unreadCountInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: {
        code: "INVALID_UNREAD_COUNT_INPUT",
        message: "unreadCount input is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const count = await deps.store.unreadCount(parsed.data.userId);
  return { ok: true as const, status: 200 as const, data: { count } };
}

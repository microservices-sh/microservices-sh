import { ok, err } from "@microservices-sh/connection-contract";
import { unreadCountInputSchema } from "../schemas";
import { notificationsInappMeta } from "../meta";
import type { NotificationStore } from "../ports";

// Accurate unread badge count for one user. Counts readAt IS NULL rows in the
// store rather than the length of a (capped, paginated) list — listing with a
// limit would undercount once a user has more unread than the page size.
export async function getUnreadCount(
  input: unknown,
  deps: { store: NotificationStore; correlationId?: string }
) {
  const meta = notificationsInappMeta(deps);

  const parsed = unreadCountInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "notifications-inapp.INVALID_UNREAD_COUNT_INPUT",
        message: "unreadCount input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const count = await deps.store.unreadCount(parsed.data.userId);
  return ok(200, { count }, meta);
}

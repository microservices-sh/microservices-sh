import { ok, err } from "@microservices-sh/connection-contract";
import { markAllReadInputSchema } from "../schemas";
import { notificationsInappMeta } from "../meta";
import type { NotificationStore } from "../ports";

// Mark every unread notification for one user as read (the "clear badge"
// action). Scoped to input.userId. Returns how many rows were updated.
export async function markAllRead(
  input: unknown,
  deps: { store: NotificationStore; correlationId?: string }
) {
  const meta = notificationsInappMeta(deps);

  const parsed = markAllReadInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "notifications-inapp.INVALID_MARK_ALL_READ_INPUT",
        message: "markAllRead input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const updated = await deps.store.markAllRead(parsed.data.userId);
  return ok(200, { updated }, meta);
}

import { ok, err } from "@microservices-sh/connection-contract";
import { markReadInputSchema } from "../schemas";
import { notificationsInappMeta } from "../meta";
import type { NotificationStore } from "../ports";

// Mark specific notification ids read for ONE user. The userId scope is
// mandatory: ids that belong to another user are silently ignored by the store,
// so a user can never flip another user's read state. Idempotent.
export async function markRead(
  input: unknown,
  deps: { store: NotificationStore; correlationId?: string }
) {
  const meta = notificationsInappMeta(deps);

  const parsed = markReadInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "notifications-inapp.INVALID_MARK_READ_INPUT",
        message: "markRead input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const updated = await deps.store.markRead(parsed.data.ids, parsed.data.userId);
  return ok(200, { updated }, meta);
}

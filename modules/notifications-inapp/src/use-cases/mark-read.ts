import { markReadInputSchema } from "../schemas";
import type { NotificationStore } from "../ports";

// Mark specific notification ids read for ONE user. The userId scope is
// mandatory: ids that belong to another user are silently ignored by the store,
// so a user can never flip another user's read state. Idempotent.
export async function markRead(input: unknown, deps: { store: NotificationStore }) {
  const parsed = markReadInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: {
        code: "INVALID_MARK_READ_INPUT",
        message: "markRead input is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const updated = await deps.store.markRead(parsed.data.ids, parsed.data.userId);
  return { ok: true as const, status: 200 as const, data: { updated } };
}

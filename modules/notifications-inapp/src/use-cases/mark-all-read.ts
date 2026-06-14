import { markAllReadInputSchema } from "../schemas";
import type { NotificationStore } from "../ports";

// Mark every unread notification for one user as read (the "clear badge"
// action). Scoped to input.userId. Returns how many rows were updated.
export async function markAllRead(input: unknown, deps: { store: NotificationStore }) {
  const parsed = markAllReadInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: {
        code: "INVALID_MARK_ALL_READ_INPUT",
        message: "markAllRead input is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const updated = await deps.store.markAllRead(parsed.data.userId);
  return { ok: true as const, status: 200 as const, data: { updated } };
}

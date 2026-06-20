import { err } from "@microservices-sh/connection-contract";
import type { AuthContext } from "@microservices-sh/connection-contract";
import { notificationsInappMeta } from "../meta";
import { listNotifications } from "./list-notifications";
import { markRead } from "./mark-read";
import { markAllRead } from "./mark-all-read";
import { getUnreadCount } from "./get-unread-count";
import type { NotificationStore } from "../ports";

// Enforced-authorization wrappers (plans/33). The notification feed is scoped to
// the ACTOR (the signed-in user), not the org — the leak here is one user seeing
// or clearing another user's feed. These wrappers source the recipient from
// AuthContext.actorId, never from caller input, so a forged userId is inert.
// Additive strangler — the wrapped use-cases are unchanged. See the cross-user
// leak test in notifications-inapp.test.ts.

type ScopedDeps = { store: NotificationStore; correlationId?: string };

// An actor scope must be present, else the call is refused (403) rather than run
// against a caller-supplied user.
function requireActor(ctx: AuthContext | undefined, deps: ScopedDeps) {
  if (!ctx || typeof ctx.actorId !== "string" || ctx.actorId.length === 0) {
    return err(
      403,
      { code: "notifications-inapp.SCOPE_REQUIRED", message: "An authenticated actor is required." },
      notificationsInappMeta(deps)
    );
  }
  return null;
}

function withActor(input: unknown, actorId: string) {
  const base = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return { ...base, userId: actorId };
}

export async function listNotificationsScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof listNotifications>[1]) {
  const denied = requireActor(ctx, deps);
  if (denied) return denied;
  return listNotifications(withActor(input, ctx.actorId), deps);
}

export async function markReadScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof markRead>[1]) {
  const denied = requireActor(ctx, deps);
  if (denied) return denied;
  return markRead(withActor(input, ctx.actorId), deps);
}

export async function markAllReadScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof markAllRead>[1]) {
  const denied = requireActor(ctx, deps);
  if (denied) return denied;
  return markAllRead(withActor(input, ctx.actorId), deps);
}

export async function getUnreadCountScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof getUnreadCount>[1]) {
  const denied = requireActor(ctx, deps);
  if (denied) return denied;
  return getUnreadCount(withActor(input, ctx.actorId), deps);
}

import { pushNotificationInputSchema } from "../schemas";
import type { ChannelStore } from "../ports";

// Validate an inbound Google push notification and tell the caller whether to
// sync. A push is only a *hint* — it carries no event data — so the right action
// is to run syncCalendar(), whose syncToken cursor + deduped event store ensure an
// event delivered via BOTH push and the next poll is processed exactly once. This
// use case authenticates the channel (id + resourceId + echoed token must match a
// stored active channel) and resolves which connection to sync; it deliberately
// does NOT process events directly, which is how double-processing creeps in.
export async function handlePushNotification(
  input: unknown,
  deps: { channelStore: ChannelStore }
) {
  const parsed = pushNotificationInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      data: null,
      error: { code: "INVALID_PUSH_INPUT", message: "Push input is invalid.", issues: parsed.error.issues }
    };
  }

  const channel = await deps.channelStore.get(parsed.data.channelId);
  if (!channel) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "CHANNEL_NOT_FOUND", message: "Unknown push channel." } };
  }

  // Authenticate: resource id and the echoed channel token must match, and the
  // channel must still be active. Rejecting spoofed callbacks is mandatory.
  if (channel.resourceId !== parsed.data.resourceId || channel.token !== parsed.data.token) {
    return { ok: false as const, status: 401 as const, data: null, error: { code: "CHANNEL_UNAUTHORIZED", message: "Channel token/resource mismatch." } };
  }
  if (channel.status !== "active") {
    return { ok: true as const, status: 200 as const, data: { acknowledged: true, shouldSync: false, reason: "channel-stopped" } };
  }

  // The initial "sync" handshake carries no change; ack without syncing.
  if (parsed.data.resourceState === "sync") {
    return { ok: true as const, status: 200 as const, data: { acknowledged: true, shouldSync: false, reason: "handshake" } };
  }

  // Real change: tell the caller which connection to syncCalendar(). Dedup is the
  // sync path's job (deduped event store), so re-delivered pushes are safe.
  return {
    ok: true as const,
    status: 200 as const,
    data: { acknowledged: true, shouldSync: true, tenantId: channel.tenantId, calendarId: channel.calendarId }
  };
}

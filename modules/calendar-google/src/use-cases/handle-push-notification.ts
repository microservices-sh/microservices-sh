import { ok, err } from "@microservices-sh/connection-contract";
import { pushNotificationInputSchema } from "../schemas";
import { calendarGoogleMeta } from "../meta";
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
  deps: { channelStore: ChannelStore; now?: () => number; correlationId?: string }
) {
  const meta = calendarGoogleMeta(deps);

  const parsed = pushNotificationInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "calendar-google.INVALID_PUSH_INPUT", message: "Push input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const channel = await deps.channelStore.get(parsed.data.channelId);
  if (!channel) {
    return err(404, { code: "calendar-google.CHANNEL_NOT_FOUND", message: "Unknown push channel." }, meta);
  }

  // Authenticate: resource id and the echoed channel token must match, and the
  // channel must still be active. Rejecting spoofed callbacks is mandatory.
  if (channel.resourceId !== parsed.data.resourceId || channel.token !== parsed.data.token) {
    return err(401, { code: "calendar-google.CHANNEL_UNAUTHORIZED", message: "Channel token/resource mismatch." }, meta);
  }
  if (channel.status !== "active") {
    return ok(200, { acknowledged: true, shouldSync: false, reason: "channel-stopped" }, meta);
  }

  // The initial "sync" handshake carries no change; ack without syncing.
  if (parsed.data.resourceState === "sync") {
    return ok(200, { acknowledged: true, shouldSync: false, reason: "handshake" }, meta);
  }

  // Real change: tell the caller which connection to syncCalendar(). Dedup is the
  // sync path's job (deduped event store), so re-delivered pushes are safe.
  return ok(
    200,
    { acknowledged: true, shouldSync: true, tenantId: channel.tenantId, calendarId: channel.calendarId },
    meta
  );
}

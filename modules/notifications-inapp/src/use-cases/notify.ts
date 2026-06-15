import { ok, err } from "@microservices-sh/connection-contract";
import { beforeNotify } from "../hooks";
import { notifyInputSchema } from "../schemas";
import { notificationsInappMeta } from "../meta";
import type { NotificationStore } from "../ports";
import type { DomainEvent, Notification } from "../types";

// Unified result shape for notify(): both the "created" and the idempotent
// "deduped" paths return the same object so the use-case has a single ok branch
// (a single Result<NotifyResult>) rather than a union of two ok shapes. `event`
// is only present when a new notification row was actually created.
export interface NotifyResult {
  id: string;
  userId: string;
  deduped: boolean;
  event?: DomainEvent;
}

// Create one in-app notification addressed to a specific user.
//
// IDEMPOTENCY: when `dedupKey` is supplied, the same upstream event delivered
// twice (retry, duplicate queue message) must NOT produce two notifications.
// We check (userId, dedupKey) first and return the existing row if present.
// `deduped: true` tells the caller no new row was created.
//
// This use case is framework-neutral: it never imports SvelteKit or Hono.
export async function notify(
  input: unknown,
  deps: { store: NotificationStore; now?: () => number; correlationId?: string }
) {
  const meta = notificationsInappMeta(deps);

  const parsed = notifyInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "notifications-inapp.INVALID_NOTIFICATION_INPUT",
        message: "Notification input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const data = await beforeNotify(parsed.data);

  // Idempotent path: if this (userId, dedupKey) was already recorded, return it
  // unchanged instead of inserting a duplicate.
  if (data.dedupKey) {
    const existing = await deps.store.recordDedupKey(data.userId, data.dedupKey);
    if (existing) {
      // Replay of an already-recorded (userId, dedupKey): no new row, no event.
      const replayed: NotifyResult = { id: existing.id, userId: existing.userId, deduped: true };
      return ok(200, replayed, meta);
    }
  }

  const notification: Notification = {
    id: "ntf_" + crypto.randomUUID().slice(0, 16),
    userId: data.userId,
    type: data.type,
    title: data.title ?? null,
    body: data.body ?? null,
    data: data.data,
    readAt: null,
    dedupKey: data.dedupKey ?? null,
    createdAt: new Date(deps.now?.() ?? Date.now()).toISOString()
  };

  await deps.store.insert(notification);

  const event: DomainEvent = {
    name: "notification.created",
    correlationId: meta.correlationId,
    payload: { id: notification.id, userId: notification.userId, type: notification.type }
  };

  const created: NotifyResult = { id: notification.id, userId: notification.userId, deduped: false, event };
  return ok(201, created, meta);
}

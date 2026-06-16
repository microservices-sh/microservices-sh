import { z } from "zod";

// Input to the notify use case. `type` is the discriminator and `data` is the
// polymorphic payload — intentionally `z.record(z.string(), z.unknown())` so each type
// carries its own shape. Validating the per-type shape of `data` is the host's
// concern (it knows its own notification types); this module stays generic.
export const notifyInputSchema = z.object({
  // Recipient — required. There is no broadcast path.
  userId: z.string().min(1),
  type: z.string().min(1),
  title: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  data: z.record(z.string(), z.unknown()).default({}),
  // Optional idempotency key. Repeated (userId, dedupKey) returns the existing
  // notification instead of inserting a duplicate.
  dedupKey: z.string().min(1).optional()
});

// Input to listNotifications. userId is required and drives the user scoping.
export const listNotificationsInputSchema = z.object({
  userId: z.string().min(1),
  unreadOnly: z.boolean().default(false),
  limit: z.number().int().positive().max(200).default(50),
  // Reconnect cursor — see types.NotificationListFilter.sinceIso.
  sinceIso: z.string().datetime().optional()
});

// markRead targets specific notification ids, always within one user's scope so
// a user can never mark another user's notifications read.
export const markReadInputSchema = z.object({
  userId: z.string().min(1),
  ids: z.array(z.string().min(1)).min(1)
});

export const markAllReadInputSchema = z.object({
  userId: z.string().min(1)
});

export const unreadCountInputSchema = z.object({
  userId: z.string().min(1)
});

export type NotifyInput = z.infer<typeof notifyInputSchema>;
export type ListNotificationsInput = z.infer<typeof listNotificationsInputSchema>;
export type MarkReadInput = z.infer<typeof markReadInputSchema>;
export type MarkAllReadInput = z.infer<typeof markAllReadInputSchema>;
export type UnreadCountInput = z.infer<typeof unreadCountInputSchema>;

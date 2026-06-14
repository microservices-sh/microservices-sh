import { z } from "zod";

export const connectionSchema = z.object({
  tenantId: z.string().min(1),
  calendarId: z.string().min(1).default("primary")
});

export const connectCalendarInputSchema = z.object({
  tenantId: z.string().min(1),
  calendarId: z.string().min(1).default("primary"),
  refreshToken: z.string().min(1),
  // Optional already-issued access token; if absent the first sync refreshes it.
  accessToken: z.string().min(1).optional().nullable(),
  accessTokenExpiresAt: z.number().int().nonnegative().default(0),
  scope: z.string().optional().nullable(),
  tokenType: z.string().optional().nullable()
});

export const refreshAccessTokenInputSchema = z.object({
  tenantId: z.string().min(1),
  calendarId: z.string().min(1).default("primary"),
  // Unique id of the worker invocation; used as the single-flight lease owner.
  owner: z.string().min(1),
  // Refresh when fewer than this many ms remain before expiry.
  earlyRefreshMs: z.number().int().nonnegative().default(60_000)
});

export const syncCalendarInputSchema = z.object({
  tenantId: z.string().min(1),
  calendarId: z.string().min(1).default("primary"),
  // Max events to pull per sync run (paging guard).
  maxPages: z.number().int().positive().max(50).default(10)
});

export const renewExpiringChannelsInputSchema = z.object({
  // Renew channels expiring within this window from now (ms). Default 24h.
  renewWithinMs: z.number().int().positive().default(86_400_000),
  // Channel TTL requested from Google for the new channel (ms). Default 7 days.
  ttlMs: z.number().int().positive().default(604_800_000),
  // Callback URL Google posts push notifications to.
  callbackUrl: z.string().url(),
  limit: z.number().int().positive().max(500).default(100)
});

export const pushNotificationInputSchema = z.object({
  // Values from the X-Goog-* headers of the inbound push request.
  channelId: z.string().min(1),
  resourceId: z.string().min(1),
  // Echoed X-Goog-Channel-Token; must match the stored channel secret.
  token: z.string().min(1),
  // "sync" (handshake) | "exists" | "not_exists".
  resourceState: z.string().min(1).default("exists")
});

export const listEventsFilterSchema = z.object({
  tenantId: z.string().min(1),
  calendarId: z.string().min(1).default("primary"),
  limit: z.number().int().positive().max(500).default(100)
});

export type ConnectCalendarInput = z.infer<typeof connectCalendarInputSchema>;
export type RefreshAccessTokenInput = z.infer<typeof refreshAccessTokenInputSchema>;
export type SyncCalendarInput = z.infer<typeof syncCalendarInputSchema>;
export type RenewExpiringChannelsInput = z.infer<typeof renewExpiringChannelsInputSchema>;
export type PushNotificationInput = z.infer<typeof pushNotificationInputSchema>;
export type ListEventsFilter = z.infer<typeof listEventsFilterSchema>;

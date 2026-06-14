import { z } from "zod";

export const configSchema = z.object({
  defaultCalendarId: z.string().min(1).default("primary"),
  // Refresh the access token when fewer than this many ms remain (clock-skew slack).
  earlyRefreshMs: z.number().int().nonnegative().default(60_000),
  // How long a single-flight refresh lease is held before it is considered stale
  // and another worker may take over (prevents a crashed refresher wedging others).
  refreshLeaseMs: z.number().int().positive().default(15_000),
  // Renew watch channels expiring within this window (ms). Google channels last
  // ~7 days; renewing well ahead avoids the silent sync-stops-after-7-days bug.
  channelRenewWithinMs: z.number().int().positive().default(86_400_000),
  channelTtlMs: z.number().int().positive().default(604_800_000),
  defaultMaxPages: z.number().int().positive().max(50).default(10),
  defaultListLimit: z.number().int().positive().max(500).default(100)
});

export const defaultConfig = {
  defaultCalendarId: "primary",
  earlyRefreshMs: 60_000,
  refreshLeaseMs: 15_000,
  channelRenewWithinMs: 86_400_000,
  channelTtlMs: 604_800_000,
  defaultMaxPages: 10,
  defaultListLimit: 100
} satisfies z.infer<typeof configSchema>;

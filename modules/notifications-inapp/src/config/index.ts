import { z } from "zod";

export const configSchema = z.object({
  // Default page size for listNotifications when the caller omits `limit`.
  defaultListLimit: z.number().int().positive().max(200).default(50),
  // Hard cap on a single notify call's payload size, in bytes of serialized
  // `data`. Guards against unbounded blobs in the feed table.
  maxDataBytes: z.number().int().positive().default(16384)
});

export const defaultConfig = {
  defaultListLimit: 50,
  maxDataBytes: 16384
} satisfies z.infer<typeof configSchema>;

import { z } from "zod";

export const configSchema = z.object({
  // Content types accepted by default (images + PDF). Override via allowContentType hook.
  allowedContentTypes: z
    .array(z.string())
    .default(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "application/pdf"]),
  // Hard upper bound on a single object, in bytes (default 10 MB).
  maxBytes: z.number().int().positive().default(10_485_760),
  // How long an upload ticket stays valid before it is eligible for cleanup.
  ticketTtlMs: z.number().int().positive().default(900_000),
  defaultListLimit: z.number().int().positive().max(500).default(100)
});

export const defaultConfig = {
  allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "application/pdf"],
  maxBytes: 10_485_760,
  ticketTtlMs: 900_000,
  defaultListLimit: 100
} satisfies z.infer<typeof configSchema>;

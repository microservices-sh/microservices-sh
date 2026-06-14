import { z } from "zod";

export const configSchema = z.object({
  // Content types accepted for attachment references (mirrors file-media). Anything
  // outside this allowlist is rejected at submit time.
  allowedAttachmentTypes: z
    .array(z.string())
    .default(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]),
  // Hard upper bound on a single attachment, in bytes (default 10 MB).
  maxAttachmentBytes: z.number().int().positive().default(10_485_760),
  // Whether new forms default to requiring a Turnstile token. Per-form override wins.
  defaultRequireTurnstile: z.boolean().default(false),
  defaultListLimit: z.number().int().positive().max(500).default(100)
});

export const defaultConfig = {
  allowedAttachmentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"],
  maxAttachmentBytes: 10_485_760,
  defaultRequireTurnstile: false,
  defaultListLimit: 100
} satisfies z.infer<typeof configSchema>;

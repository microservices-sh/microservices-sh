import { z } from "zod";

const simpleEmailSchema = z.string().trim().email().max(320);
const senderAddressSchema = z
  .string()
  .trim()
  .min(3)
  .max(512)
  .refine((value) => {
    if (simpleEmailSchema.safeParse(value).success) return true;
    return /^[^<>]+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/.test(value);
  }, "Expected an email address or friendly sender address like Name <sender@example.com>.");

const recipientListSchema = z.preprocess(
  (value) => (typeof value === "string" ? [value] : value),
  z.array(simpleEmailSchema).min(1).max(50)
);

const optionalRecipientListSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return undefined;
    return typeof value === "string" ? [value] : value;
  },
  z.array(simpleEmailSchema).min(1).max(50).optional()
);

const tagSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/),
  value: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/)
});

const attachmentSchema = z
  .object({
    filename: z.string().min(1).max(255),
    content: z.string().min(1).optional(),
    path: z.url().optional()
  })
  .refine((value) => Boolean(value.content || value.path), {
    message: "Attachment must include content or path."
  });

const templateSchema = z.object({
  id: z.string().min(1).max(256),
  variables: z.record(z.string(), z.union([z.string().max(2000), z.number().safe()])).optional()
});

export const emailConfigSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(["resend", "stacksuite"]).default("resend"),
  defaultFrom: senderAddressSchema.nullable().default(null),
  apiBaseUrl: z.url().default("https://api.resend.com"),
  userAgent: z.string().min(1).max(256).default("microservices-sh-email/0.1.0"),
  testMode: z.boolean().default(false),
  redactRecipientsInEvents: z.boolean().default(true)
});

export const sendEmailInputSchema = z
  .object({
    from: senderAddressSchema.optional(),
    to: recipientListSchema,
    cc: optionalRecipientListSchema,
    bcc: optionalRecipientListSchema,
    replyTo: optionalRecipientListSchema,
    subject: z.string().trim().min(1).max(998),
    html: z.string().min(1).max(1_000_000).optional(),
    text: z.string().min(1).max(1_000_000).optional(),
    headers: z.record(z.string().min(1), z.string().max(998)).optional(),
    attachments: z.array(attachmentSchema).max(10).optional(),
    tags: z.array(tagSchema).max(10).optional(),
    template: templateSchema.optional(),
    idempotencyKey: z.string().min(1).max(256).optional(),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .superRefine((value, context) => {
    if (value.template && (value.html || value.text)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Template emails cannot also include html or text."
      });
    }

    if (!value.template && !value.html && !value.text) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email must include html, text, or template."
      });
    }
  });

export const emailDeliverySchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  providerMessageId: z.string().nullable(),
  status: z.enum(["queued", "sent", "failed"]),
  fromAddress: senderAddressSchema,
  toAddresses: z.array(simpleEmailSchema),
  ccAddresses: z.array(simpleEmailSchema).default([]),
  bccAddresses: z.array(simpleEmailSchema).default([]),
  subject: z.string().min(1),
  idempotencyKey: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export type EmailConfigInput = z.infer<typeof emailConfigSchema>;
export type SendEmailInputSchema = z.infer<typeof sendEmailInputSchema>;

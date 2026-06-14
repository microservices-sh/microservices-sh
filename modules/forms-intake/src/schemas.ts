import { z } from "zod";

// Field definition schema — this is what round-trips through D1 as JSON. Kept in
// lockstep with FormField in types.ts so the stored definition and the validator
// agree (the drift agents introduce by validating in route code).
export const fieldValidationSchema = z
  .object({
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(0).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().max(500).optional(),
    options: z.array(z.string()).optional()
  })
  .strict();

export const fieldConditionSchema = z
  .object({
    field: z.string().min(1),
    equals: z.string()
  })
  .strict();

export const formFieldSchema = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().min(1).max(200),
    type: z.enum(["text", "email", "number", "checkbox", "select"]),
    required: z.boolean().default(false),
    validation: fieldValidationSchema.optional(),
    visibleWhen: fieldConditionSchema.optional()
  })
  .strict();

export const createFormInputSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1).max(200),
  fields: z.array(formFieldSchema).max(200).default([]),
  // Whether submissions require a Turnstile token (spam protection). Optional.
  requireTurnstile: z.boolean().default(false)
});

export const updateFormInputSchema = z.object({
  formId: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  fields: z.array(formFieldSchema).max(200).optional(),
  requireTurnstile: z.boolean().optional()
});

export const getFormInputSchema = z.object({
  formId: z.string().min(1),
  tenantId: z.string().min(1)
});

export const attachmentRefSchema = z.object({
  fieldId: z.string().min(1),
  key: z.string().min(1).max(1024),
  contentType: z.string().min(1).max(255),
  bytes: z.number().int().positive(),
  originalName: z.string().min(1).max(255)
});

export const submitFormInputSchema = z.object({
  formId: z.string().min(1),
  tenantId: z.string().min(1),
  // Raw, un-coerced submitted values; the pure validator coerces + checks them.
  values: z.record(z.string(), z.unknown()).default({}),
  attachments: z.array(attachmentRefSchema).max(20).default([]),
  // Optional dedup key (e.g. client-generated UUID) so a retried POST submits once.
  idempotencyKey: z.string().min(1).max(200).optional().nullable(),
  // Spam-protection token + optional client IP, forwarded to the TurnstileVerifier.
  turnstileToken: z.string().min(1).optional().nullable(),
  ip: z.string().min(1).max(64).optional().nullable()
});

export const listFormsFilterSchema = z.object({
  tenantId: z.string().min(1),
  status: z.enum(["draft", "published", "archived"]).optional(),
  limit: z.number().int().positive().max(500).default(100)
});

export const listSubmissionsFilterSchema = z.object({
  tenantId: z.string().min(1),
  formId: z.string().min(1),
  limit: z.number().int().positive().max(500).default(100)
});

export type FieldValidationInput = z.infer<typeof fieldValidationSchema>;
export type FormFieldInput = z.infer<typeof formFieldSchema>;
export type CreateFormInput = z.infer<typeof createFormInputSchema>;
export type UpdateFormInput = z.infer<typeof updateFormInputSchema>;
export type GetFormInput = z.infer<typeof getFormInputSchema>;
export type SubmitFormInput = z.infer<typeof submitFormInputSchema>;
export type ListFormsFilter = z.infer<typeof listFormsFilterSchema>;
export type ListSubmissionsFilter = z.infer<typeof listSubmissionsFilterSchema>;

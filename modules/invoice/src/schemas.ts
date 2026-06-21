import { z } from "zod";

export const lineItemInputSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive().default(1),
  unitAmountCents: z.number().int(),
  taxRateBps: z.number().int().min(0).max(100_000).default(0)
});

export const recurringInvoiceFrequencySchema = z.enum(["weekly", "monthly", "quarterly", "yearly", "custom"]);
export const recurringInvoiceStatusSchema = z.enum(["active", "paused", "cancelled", "completed"]);

export const createInvoiceInputSchema = z.object({
  tenantId: z.string().min(1),
  customerId: z.string().min(1),
  currency: z.string().min(3).max(3).default("USD"),
  series: z.string().min(1).max(32).default("INV"),
  notes: z.string().max(2000).optional().nullable(),
  recurringTemplateId: z.string().min(1).optional().nullable(),
  recurringOccurrenceAt: z.string().datetime().optional().nullable(),
  lineItems: z.array(lineItemInputSchema).default([])
});

export const issueInvoiceInputSchema = z.object({
  invoiceId: z.string().min(1),
  // Net payment terms in days; dueAt = issuedAt + termsDays.
  termsDays: z.number().int().min(0).max(365).default(14)
});

export const recordPaymentInputSchema = z.object({
  invoiceId: z.string().min(1),
  amountCents: z.number().int().positive(),
  // Dedup key (e.g. Stripe event id) so a redelivered webhook is applied once.
  idempotencyKey: z.string().min(1).optional().nullable()
});

export const createInvoicePaymentLinkInputSchema = z.object({
  invoiceId: z.string().min(1),
  successUrl: z.string().url().optional(),
  customerEmail: z.string().email().optional()
});

export const listInvoicesFilterSchema = z.object({
  tenantId: z.string().min(1),
  customerId: z.string().optional(),
  status: z.enum(["draft", "open", "paid", "void"]).optional(),
  limit: z.number().int().positive().max(500).default(100)
});

export const createRecurringInvoiceTemplateInputSchema = z
  .object({
    tenantId: z.string().min(1),
    customerId: z.string().min(1),
    name: z.string().min(1).max(300),
    currency: z.string().min(3).max(3).default("USD"),
    series: z.string().min(1).max(32).default("INV"),
    frequency: recurringInvoiceFrequencySchema.default("monthly"),
    customDays: z.number().int().positive().nullable().optional(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime().nullable().optional(),
    paymentTermsDays: z.number().int().min(0).max(365).default(14),
    maxOccurrences: z.number().int().positive().nullable().optional(),
    autoIssue: z.boolean().default(false),
    notes: z.string().max(2000).optional().nullable(),
    lineItems: z.array(lineItemInputSchema).min(1)
  })
  .superRefine((input, ctx) => {
    if (input.frequency === "custom" && !input.customDays) {
      ctx.addIssue({
        code: "custom",
        path: ["customDays"],
        message: "customDays is required when frequency is custom."
      });
    }
    if (input.endAt && Date.parse(input.endAt) < Date.parse(input.startAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "endAt must be after startAt."
      });
    }
  });

export const listRecurringInvoiceTemplatesInputSchema = z.object({
  tenantId: z.string().min(1),
  customerId: z.string().optional(),
  status: recurringInvoiceStatusSchema.optional(),
  statuses: z.array(recurringInvoiceStatusSchema).optional(),
  dueOnOrBefore: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).default(100)
});

export const updateRecurringInvoiceTemplateStatusInputSchema = z.object({
  tenantId: z.string().min(1),
  templateId: z.string().min(1),
  status: recurringInvoiceStatusSchema
});

export const generateDueRecurringInvoicesInputSchema = z.object({
  tenantId: z.string().min(1),
  asOfDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(25)
});

export type LineItemInput = z.infer<typeof lineItemInputSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceInputSchema>;
export type IssueInvoiceInput = z.infer<typeof issueInvoiceInputSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentInputSchema>;
export type CreateInvoicePaymentLinkInput = z.infer<typeof createInvoicePaymentLinkInputSchema>;
export type ListInvoicesFilter = z.infer<typeof listInvoicesFilterSchema>;
export type CreateRecurringInvoiceTemplateInput = z.infer<typeof createRecurringInvoiceTemplateInputSchema>;
export type ListRecurringInvoiceTemplatesInput = z.infer<typeof listRecurringInvoiceTemplatesInputSchema>;
export type UpdateRecurringInvoiceTemplateStatusInput = z.infer<typeof updateRecurringInvoiceTemplateStatusInputSchema>;
export type GenerateDueRecurringInvoicesInput = z.infer<typeof generateDueRecurringInvoicesInputSchema>;

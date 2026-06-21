import { z } from "zod";

export const recurringDocumentsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultCurrency: z.string().length(3).default("USD"),
  defaultPaymentTermsDays: z.number().int().positive().default(30)
});

export const recurringDocumentTypeSchema = z.enum(["invoice", "bill"]);
export const recurringTemplateStatusSchema = z.enum(["active", "paused", "completed", "cancelled"]);
export const recurringFrequencySchema = z.enum(["weekly", "monthly", "quarterly", "yearly", "custom"]);

export const recurringDocumentLineSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  templateId: z.string().min(1),
  productId: z.string().min(1).nullable(),
  expenseAccountId: z.string().min(1).nullable(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  lineTotalCents: z.number().int().nonnegative(),
  sortOrder: z.number().int().nonnegative()
});

export const recurringDocumentTemplateSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  documentType: recurringDocumentTypeSchema,
  partyType: z.enum(["customer", "vendor"]),
  partyId: z.string().min(1),
  frequency: recurringFrequencySchema,
  customDays: z.number().int().positive().nullable(),
  status: recurringTemplateStatusSchema,
  startDate: z.string().min(1),
  endDate: z.string().min(1).nullable(),
  nextRunDate: z.string().min(1).nullable(),
  lastRunDate: z.string().min(1).nullable(),
  paymentTermsDays: z.number().int().positive(),
  maxOccurrences: z.number().int().positive().nullable(),
  occurrencesGenerated: z.number().int().nonnegative(),
  subtotalCents: z.number().int().nonnegative(),
  taxBasisPoints: z.number().int().nonnegative(),
  taxCents: z.number().int().nonnegative(),
  discountCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  lines: z.array(recurringDocumentLineSchema)
});

export const recurringDocumentsRecordSchema = recurringDocumentTemplateSchema;

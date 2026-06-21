import { z } from "zod";

export const estimateQuoteConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultCurrency: z.string().length(3).default("USD"),
  quoteNumberPrefix: z.string().min(1).default("EST"),
  defaultExpiryDays: z.number().int().positive().default(30)
});

export const estimateQuoteStatusSchema = z.enum(["draft", "sent", "viewed", "accepted", "declined", "expired", "converted", "void"]);

export const estimateQuoteLineSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  quoteId: z.string().min(1),
  productId: z.string().min(1).nullable(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  lineTotalCents: z.number().int().nonnegative(),
  sortOrder: z.number().int().nonnegative()
});

export const estimateQuoteSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  quoteNumber: z.string().min(1),
  clientId: z.string().min(1),
  status: estimateQuoteStatusSchema,
  issueDate: z.string().min(1),
  expiryDate: z.string().min(1).nullable(),
  sentAt: z.string().min(1).nullable(),
  viewedAt: z.string().min(1).nullable(),
  acceptedAt: z.string().min(1).nullable(),
  declinedAt: z.string().min(1).nullable(),
  expiredAt: z.string().min(1).nullable(),
  convertedAt: z.string().min(1).nullable(),
  voidedAt: z.string().min(1).nullable(),
  subtotalCents: z.number().int().nonnegative(),
  taxBasisPoints: z.number().int().nonnegative(),
  taxCents: z.number().int().nonnegative(),
  discountCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  notes: z.string().nullable(),
  terms: z.string().nullable(),
  convertedToInvoiceId: z.string().min(1).nullable(),
  pdfKey: z.string().min(1).nullable(),
  createdById: z.string().min(1).nullable(),
  updatedById: z.string().min(1).nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  lines: z.array(estimateQuoteLineSchema)
});

export const estimateQuoteRecordSchema = estimateQuoteSchema;

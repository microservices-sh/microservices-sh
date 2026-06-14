import { z } from "zod";

export const lineItemInputSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive().default(1),
  unitAmountCents: z.number().int(),
  taxRateBps: z.number().int().min(0).max(100_000).default(0)
});

export const createInvoiceInputSchema = z.object({
  tenantId: z.string().min(1),
  customerId: z.string().min(1),
  currency: z.string().min(3).max(3).default("USD"),
  series: z.string().min(1).max(32).default("INV"),
  notes: z.string().max(2000).optional().nullable(),
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

export const listInvoicesFilterSchema = z.object({
  tenantId: z.string().min(1),
  customerId: z.string().optional(),
  status: z.enum(["draft", "open", "paid", "void"]).optional(),
  limit: z.number().int().positive().max(500).default(100)
});

export type LineItemInput = z.infer<typeof lineItemInputSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceInputSchema>;
export type IssueInvoiceInput = z.infer<typeof issueInvoiceInputSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentInputSchema>;
export type ListInvoicesFilter = z.infer<typeof listInvoicesFilterSchema>;

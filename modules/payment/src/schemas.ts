import { z } from "zod";

export const createPaymentIntentInputSchema = z.object({
  customerId: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string().min(3).max(8).default("usd"),
  description: z.string().optional().nullable()
});

export const getPaymentInputSchema = z.object({
  id: z.string().min(1)
});

export const listPaymentsFilterSchema = z.object({
  customerId: z.string().optional(),
  status: z.enum(["pending", "succeeded", "refunded", "failed"]).optional(),
  limit: z.number().int().positive().max(500).default(100)
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentInputSchema>;
export type GetPaymentInput = z.infer<typeof getPaymentInputSchema>;
export type ListPaymentsFilter = z.infer<typeof listPaymentsFilterSchema>;

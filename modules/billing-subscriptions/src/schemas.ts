import { z } from "zod";

export const createPlanInputSchema = z.object({
  name: z.string().min(1).max(120),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3).default("USD"),
  interval: z.enum(["month", "year"]).default("month"),
  stripePriceId: z.string().optional().nullable(),
  features: z.array(z.string()).default([])
});

export const startSubscriptionInputSchema = z.object({
  subscriberId: z.string().min(1),
  planId: z.string().min(1),
  trialDays: z.number().int().min(0).max(365).default(0),
  stripeSubscriptionId: z.string().optional().nullable()
});

export const changePlanInputSchema = z.object({
  subscriptionId: z.string().min(1),
  newPlanId: z.string().min(1)
});

export const cancelSubscriptionInputSchema = z.object({
  subscriptionId: z.string().min(1),
  atPeriodEnd: z.boolean().default(true)
});

export const recordUsageInputSchema = z.object({
  subscriptionId: z.string().min(1),
  meter: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  idempotencyKey: z.string().min(1).optional().nullable()
});

export const listSubscriptionsFilterSchema = z.object({
  subscriberId: z.string().optional(),
  status: z.enum(["trialing", "active", "past_due", "unpaid", "paused", "canceled"]).optional(),
  limit: z.number().int().positive().max(500).default(100)
});

export type CreatePlanInput = z.infer<typeof createPlanInputSchema>;
export type StartSubscriptionInput = z.infer<typeof startSubscriptionInputSchema>;
export type ChangePlanInput = z.infer<typeof changePlanInputSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionInputSchema>;
export type RecordUsageInput = z.infer<typeof recordUsageInputSchema>;
export type ListSubscriptionsFilter = z.infer<typeof listSubscriptionsFilterSchema>;

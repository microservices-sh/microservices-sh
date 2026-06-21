import { z } from "zod";

export const membershipCreditsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultCurrency: z.string().optional()
});

export const membershipTierSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  level: z.number().int(),
  discountBasisPoints: z.number().int().min(0),
  isFree: z.boolean(),
  isDefault: z.boolean(),
  priceMonthlyCents: z.number().int().nullable(),
  priceYearlyCents: z.number().int().nullable(),
  priceLifetimeCents: z.number().int().nullable(),
  currency: z.string().min(1),
  benefits: z.array(z.string()),
  badgeColor: z.string().nullable(),
  badgeIcon: z.string().nullable(),
  maxAdvanceBookingDays: z.number().int().nullable(),
  maxBookingsPerMonth: z.number().int().nullable(),
  priorityBookingHours: z.number().int(),
  status: z.enum(["active", "inactive", "archived"]),
  position: z.number().int(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const customerMembershipSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  customerId: z.string().min(1),
  tierId: z.string().min(1),
  status: z.enum(["active", "expired", "cancelled", "suspended"]),
  subscriptionType: z.enum(["manual", "monthly", "yearly", "lifetime"]),
  startedAt: z.string().min(1),
  expiresAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  autoRenew: z.boolean(),
  gracePeriodEndsAt: z.string().nullable(),
  externalSubscriptionId: z.string().nullable(),
  externalCustomerId: z.string().nullable(),
  previousTierId: z.string().nullable(),
  source: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const customerCreditBalanceSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  customerId: z.string().min(1),
  balanceCents: z.number().int(),
  totalCreditedCents: z.number().int(),
  totalUsedCents: z.number().int(),
  currency: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const creditTransactionSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  customerId: z.string().min(1),
  type: z.enum(["credit", "debit"]),
  amountCents: z.number().int().positive(),
  balanceBeforeCents: z.number().int(),
  balanceAfterCents: z.number().int(),
  source: z.enum(["admin_grant", "admin_deduct", "booking_refund", "booking_payment", "payment", "adjustment"]),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  description: z.string().min(1),
  performedBy: z.string().nullable(),
  createdAt: z.string().min(1)
});

export const membershipHistoryEntrySchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  membershipId: z.string().min(1),
  fromTierId: z.string().nullable(),
  toTierId: z.string().nullable(),
  action: z.enum(["created", "upgraded", "downgraded", "renewed", "cancelled", "expired", "suspended", "reactivated"]),
  reason: z.string().nullable(),
  performedBy: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().min(1)
});

export const membershipCreditsRecordSchema = z.union([
  membershipTierSchema,
  customerMembershipSchema,
  customerCreditBalanceSchema,
  creditTransactionSchema,
  membershipHistoryEntrySchema
]);

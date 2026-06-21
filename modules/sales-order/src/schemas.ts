import { z } from "zod";

export const salesOrderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultCurrency: z.string().min(3).max(3).default("USD")
});

export const salesOrderStatusSchema = z.enum(["draft", "confirmed", "cancelled", "invoiced"]);

export const customerSnapshotSchema = z.object({
  displayName: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  billingAddress: z.string().nullable().optional(),
  shippingAddress: z.string().nullable().optional(),
  taxId: z.string().nullable().optional()
});

export const salesOrderLineInputSchema = z.object({
  productId: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().min(0),
  discountCents: z.number().int().min(0).default(0),
  taxCents: z.number().int().min(0).default(0),
  externalId: z.string().nullable().optional(),
  externalSource: z.string().nullable().optional()
});

export const createDraftOrderInputSchema = z.object({
  tenantId: z.string().min(1),
  orderNumber: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  customerSnapshot: customerSnapshotSchema.nullable().optional(),
  externalId: z.string().nullable().optional(),
  externalSource: z.string().nullable().optional(),
  currency: z.string().min(3).max(3).default("USD"),
  notes: z.string().nullable().optional(),
  lineItems: z.array(salesOrderLineInputSchema).min(1)
});

export const salesOrderIdentitySchema = z.object({
  tenantId: z.string().min(1),
  orderId: z.string().min(1)
});

export const cancelOrderInputSchema = salesOrderIdentitySchema.extend({
  reason: z.string().nullable().optional()
});

export const salesOrderFilterSchema = z.object({
  tenantId: z.string().min(1),
  status: salesOrderStatusSchema.optional(),
  customerId: z.string().optional(),
  externalSource: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional()
});

export const salesOrderRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  status: salesOrderStatusSchema,
  currency: z.string().min(3).max(3),
  totalCents: z.number().int().min(0),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

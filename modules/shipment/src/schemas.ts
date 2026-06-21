import { z } from "zod";

export const shipmentConfigSchema = z.object({
  enabled: z.boolean().default(true)
});

export const shipmentStatusSchema = z.enum(["draft", "processing", "completed", "cancelled"]);
export const shipmentSourceTypeSchema = z.enum(["sales-order", "invoice", "manual"]);

export const shipmentItemInputSchema = z.object({
  sourceType: shipmentSourceTypeSchema,
  sourceId: z.string().min(1),
  productId: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  description: z.string().min(1),
  quantity: z.number().positive()
});

export const shipmentInputSchema = z.object({
  tenantId: z.string().min(1),
  shipmentNumber: z.string().nullable().optional(),
  carrier: z.string().nullable().optional(),
  trackingNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  externalId: z.string().nullable().optional(),
  externalSource: z.string().nullable().optional(),
  items: z.array(shipmentItemInputSchema).min(1)
});

export const shipmentFilterSchema = z.object({
  tenantId: z.string().min(1),
  status: shipmentStatusSchema.optional(),
  sourceType: shipmentSourceTypeSchema.optional(),
  sourceId: z.string().optional(),
  includeCancelled: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional()
});

export const getShipmentSchema = z.object({
  tenantId: z.string().min(1),
  shipmentId: z.string().min(1)
});

export const completeShipmentSchema = getShipmentSchema.extend({
  completionRef: z.string().min(1),
  completedAt: z.string().optional()
});

export const cancelShipmentSchema = getShipmentSchema.extend({
  reason: z.string().optional()
});

export const shipmentRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  status: shipmentStatusSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

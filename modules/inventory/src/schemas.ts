import { z } from "zod";

const safeIntegerSchema = z
  .number()
  .int()
  .refine(Number.isSafeInteger, "Expected a safe integer quantity.");

export const stockQuantitySchema = safeIntegerSchema.min(0);
export const positiveStockQuantitySchema = safeIntegerSchema.min(1);

export const inventoryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultLocationId: z.string().min(1).default("default")
});

export const stockMovementTypeSchema = z.enum(["stock_in", "reservation", "release", "deduction", "adjustment"]);

export const optionalSourceRefSchema = z
  .object({
    sourceType: z.string().min(1).max(120).nullable().optional(),
    sourceId: z.string().min(1).max(240).nullable().optional()
  })
  .superRefine((value, ctx) => {
    const hasSourceType = value.sourceType != null && value.sourceType !== "";
    const hasSourceId = value.sourceId != null && value.sourceId !== "";
    if (hasSourceType !== hasSourceId) {
      ctx.addIssue({
        code: "custom",
        message: "sourceType and sourceId must be supplied together.",
        path: ["sourceRef"]
      });
    }
  });

export const requiredSourceRefSchema = z.object({
  sourceType: z.string().min(1).max(120),
  sourceId: z.string().min(1).max(240)
});

const baseStockInputSchema = z.object({
  tenantId: z.string().min(1),
  productId: z.string().min(1),
  locationId: z.string().min(1).default("default"),
  reason: z.string().min(1).max(500).nullable().optional()
});

export const stockInInputSchema = baseStockInputSchema
  .extend({
    quantity: positiveStockQuantitySchema
  })
  .and(optionalSourceRefSchema);

export const reserveStockInputSchema = baseStockInputSchema
  .extend({
    quantity: positiveStockQuantitySchema
  })
  .and(requiredSourceRefSchema);

export const releaseReservationInputSchema = baseStockInputSchema
  .extend({
    quantity: positiveStockQuantitySchema
  })
  .and(requiredSourceRefSchema);

export const deductStockInputSchema = baseStockInputSchema
  .extend({
    quantity: positiveStockQuantitySchema,
    consumeReserved: z.boolean().default(false)
  })
  .and(requiredSourceRefSchema);

export const reconcileStockInputSchema = baseStockInputSchema
  .extend({
    countedQuantity: stockQuantitySchema
  })
  .and(requiredSourceRefSchema);

export const stockBalanceLookupSchema = z.object({
  tenantId: z.string().min(1),
  productId: z.string().min(1),
  locationId: z.string().min(1).default("default")
});

export const stockMovementFilterSchema = z
  .object({
    tenantId: z.string().min(1),
    productId: z.string().min(1).optional(),
    locationId: z.string().min(1).optional(),
    movementType: stockMovementTypeSchema.optional(),
    sourceType: z.string().min(1).optional(),
    sourceId: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(500).optional()
  })
  .superRefine((value, ctx) => {
    if ((value.sourceType && !value.sourceId) || (value.sourceId && !value.sourceType)) {
      ctx.addIssue({
        code: "custom",
        message: "sourceType and sourceId filters must be supplied together.",
        path: ["sourceRef"]
      });
    }
  });

export const stockMovementRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  productId: z.string().min(1),
  locationId: z.string().min(1),
  movementType: stockMovementTypeSchema,
  quantity: stockQuantitySchema,
  onHandDelta: safeIntegerSchema,
  reservedDelta: safeIntegerSchema,
  createdAt: z.string().min(1)
});

export type StockInInput = z.infer<typeof stockInInputSchema>;
export type ReserveStockInput = z.infer<typeof reserveStockInputSchema>;
export type ReleaseReservationInput = z.infer<typeof releaseReservationInputSchema>;
export type DeductStockInput = z.infer<typeof deductStockInputSchema>;
export type ReconcileStockInput = z.infer<typeof reconcileStockInputSchema>;

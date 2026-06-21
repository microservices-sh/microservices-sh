import { z } from "zod";

export const productCatalogConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultCurrency: z.string().min(3).max(3).default("USD")
});

export const productTypeSchema = z.enum(["simple", "combo"]);

export const categoryInputSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  color: z.string().min(1).default("#6B7280")
});

export const categoryUpdateSchema = categoryInputSchema.partial().extend({
  tenantId: z.string().min(1),
  categoryId: z.string().min(1),
  active: z.boolean().optional()
});

export const comboComponentInputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive()
});

export const productInputSchema = z.object({
  tenantId: z.string().min(1),
  sku: z.string().min(1),
  alias: z.string().nullable().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  priceCents: z.number().int().min(0).default(0),
  currency: z.string().min(3).max(3).default("USD"),
  unit: z.string().min(1).default("unit"),
  productType: productTypeSchema.default("simple"),
  active: z.boolean().default(true),
  externalId: z.string().nullable().optional(),
  externalSource: z.string().nullable().optional(),
  trackStock: z.boolean().default(true),
  reorderPoint: z.number().min(0).default(0),
  reorderQuantity: z.number().min(0).default(0),
  categoryIds: z.array(z.string().min(1)).default([]),
  comboComponents: z.array(comboComponentInputSchema).default([])
});

export const productUpdateSchema = productInputSchema
  .omit({ categoryIds: true, comboComponents: true })
  .partial()
  .extend({
    tenantId: z.string().min(1),
    productId: z.string().min(1),
    categoryIds: z.array(z.string().min(1)).optional(),
    comboComponents: z.array(comboComponentInputSchema).optional()
  });

export const productFilterSchema = z.object({
  tenantId: z.string().min(1),
  search: z.string().optional(),
  includeInactive: z.boolean().optional(),
  productType: productTypeSchema.optional(),
  categoryId: z.string().optional(),
  externalSource: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional()
});

export const categoryFilterSchema = z.object({
  tenantId: z.string().min(1),
  includeInactive: z.boolean().optional()
});

export const setComboComponentsSchema = z.object({
  tenantId: z.string().min(1),
  comboId: z.string().min(1),
  components: z.array(comboComponentInputSchema)
});

export const productRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  productType: productTypeSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

import { z } from "zod";

export const storageEntitlementsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultQuotaBytes: z.number().int().positive().default(2147483648),
  defaultCurrency: z.string().length(3).default("USD")
});

export const storageOwnerTypeSchema = z.enum(["user", "customer", "workspace"]);
export const storagePurchaseStatusSchema = z.enum(["pending", "completed", "failed", "refunded"]);

export const storageAccountSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  ownerType: storageOwnerTypeSchema,
  ownerId: z.string().min(1),
  quotaBytes: z.number().int().nonnegative(),
  usedBytes: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const storagePackageSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  storageBytes: z.number().int().positive(),
  priceCents: z.number().int().positive(),
  currency: z.string().length(3),
  isActive: z.boolean()
});

export const storageShareLinkSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  ownerType: storageOwnerTypeSchema,
  ownerId: z.string().min(1),
  fileId: z.string().min(1),
  shortId: z.string().min(1),
  originalName: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  expiresAt: z.string().min(1),
  expiryDays: z.number().int().positive(),
  downloadCount: z.number().int().nonnegative(),
  revokedAt: z.string().min(1).nullable()
});

export const storageEntitlementsRecordSchema = storageAccountSchema;

import { z } from "zod";

export const htmlRendererConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultTtlSeconds: z.number().int().nonnegative().default(2592000),
  minTtlSeconds: z.number().int().positive().default(60),
  maxTtlSeconds: z.number().int().positive().default(2592000),
  maxHtmlBytes: z.number().int().positive().default(26214400)
});

export const htmlRenderAssetSchema = z.object({
  path: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative()
});

export const htmlRenderDocumentSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  slug: z.string().min(1),
  html: z.string().min(1),
  assets: z.array(htmlRenderAssetSchema),
  ttlSeconds: z.number().int().nonnegative().nullable(),
  expiresAt: z.string().min(1).nullable(),
  status: z.enum(["active", "deleted"]),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const createHtmlRenderInputSchema = z.object({
  html: z.string().min(1),
  slug: z.string().min(1).optional(),
  ttlSeconds: z.number().int().nonnegative().optional(),
  assets: z.array(htmlRenderAssetSchema).optional()
});

export const htmlRendererRecordSchema = htmlRenderDocumentSchema;

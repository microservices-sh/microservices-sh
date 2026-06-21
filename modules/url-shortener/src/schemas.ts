import { z } from "zod";

export const urlShortenerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  baseUrl: z.string().url().optional(),
  defaultCodeLength: z.number().int().min(4).max(16).default(6),
  maxExpiryDays: z.number().int().positive().default(365)
});

export const deviceTypeSchema = z.enum(["desktop", "mobile", "tablet", "bot", "unknown"]);

export const shortLinkSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  code: z.string().min(1),
  originalUrl: z.string().url(),
  customAlias: z.boolean(),
  expiresAt: z.string().min(1).nullable(),
  isActive: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const shortLinkClickSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  linkId: z.string().min(1),
  code: z.string().min(1),
  clickedAt: z.string().min(1),
  deviceType: deviceTypeSchema
});

export const createShortLinkInputSchema = z.object({
  url: z.string().min(1),
  customAlias: z.string().min(3).max(32).optional(),
  expiresInDays: z.number().int().positive().optional()
});

export const urlShortenerRecordSchema = shortLinkSchema;

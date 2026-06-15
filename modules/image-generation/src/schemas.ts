import { z } from "zod";

export const aspectRatioSchema = z.enum(["1:1", "3:4", "4:3", "9:16", "16:9"]);
export const providerIdSchema = z.enum(["kie-ai", "gemini", "gpt-image"]);

export const generateImageInputSchema = z.object({
  tenantId: z.string().min(1),
  prompt: z.string().min(1).max(4000),
  aspectRatio: aspectRatioSchema.default("1:1"),
  negativePrompt: z.string().max(2000).optional(),
  // Optional explicit provider override; otherwise the configured default is used.
  provider: providerIdSchema.optional(),
  source: z.enum(["studio", "agent", "api"]).default("studio"),
});

export const editImageInputSchema = z.object({
  tenantId: z.string().min(1),
  // The id of an existing generated image in the same tenant to edit.
  sourceImageId: z.string().min(1),
  prompt: z.string().min(1).max(4000),
  provider: providerIdSchema.optional(),
  source: z.enum(["studio", "agent", "api"]).default("studio"),
});

export const listImagesFilterSchema = z.object({
  tenantId: z.string().min(1),
  status: z.enum(["active", "deleted"]).default("active"),
  limit: z.number().int().positive().max(500).default(100),
});

export const getImageInputSchema = z.object({
  tenantId: z.string().min(1),
  imageId: z.string().min(1),
});

export const deleteImageInputSchema = z.object({
  tenantId: z.string().min(1),
  imageId: z.string().min(1),
});

export type GenerateImageInput = z.infer<typeof generateImageInputSchema>;
export type EditImageInput = z.infer<typeof editImageInputSchema>;
export type ListImagesFilter = z.infer<typeof listImagesFilterSchema>;
export type GetImageInput = z.infer<typeof getImageInputSchema>;
export type DeleteImageInput = z.infer<typeof deleteImageInputSchema>;

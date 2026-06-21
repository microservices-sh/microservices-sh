import { z } from "zod";

export const videoJobStatusSchema = z.enum(["draft", "submitted", "processing", "completed", "failed", "cancelled"]);
export const videoResolutionSchema = z.enum(["480p", "720p", "1080p", "4k"]);
export const videoAspectRatioSchema = z.enum(["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"]);
export const videoReferenceAssetSchema = z.object({
  path: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  role: z.enum(["reference", "image-to-video", "mask"])
});
export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const videoGenerationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultProvider: z.string().min(1).optional(),
  maxPromptLength: z.number().int().positive().optional(),
  defaultExpiryDays: z.number().int().nonnegative().optional()
});

export const videoGenerationJobSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  ownerId: z.string().nullable(),
  provider: z.string().min(1),
  providerTaskId: z.string().nullable(),
  model: z.string().nullable(),
  prompt: z.string().min(1),
  negativePrompt: z.string().nullable(),
  status: videoJobStatusSchema,
  durationSeconds: z.number().int().positive(),
  resolution: videoResolutionSchema,
  aspectRatio: videoAspectRatioSchema,
  seed: z.number().int().nullable(),
  referenceAssets: z.array(videoReferenceAssetSchema),
  progress: z.number().int().min(0).max(100).nullable(),
  errorMessage: z.string().nullable(),
  metadata: jsonObjectSchema,
  createdBy: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  submittedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  cancelledAt: z.string().nullable()
});

export const videoGenerationOutputSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  jobId: z.string().min(1),
  storageKey: z.string().nullable(),
  publicUrl: z.string().nullable(),
  providerUrl: z.string().nullable(),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSeconds: z.number().int().positive().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string().min(1)
});

export const videoGenerationSnapshotSchema = z.object({
  job: videoGenerationJobSchema,
  outputs: z.array(videoGenerationOutputSchema)
});

export const createVideoJobInputSchema = z.object({
  prompt: z.string().min(1),
  ownerId: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  negativePrompt: z.string().nullable().optional(),
  durationSeconds: z.number().int().positive().optional(),
  resolution: videoResolutionSchema.optional(),
  aspectRatio: videoAspectRatioSchema.optional(),
  seed: z.number().int().nullable().optional(),
  referenceAssets: z.array(videoReferenceAssetSchema).optional(),
  metadata: jsonObjectSchema.optional()
});

export const recordVideoProviderStatusInputSchema = z.object({
  jobId: z.string().min(1).optional(),
  providerTaskId: z.string().min(1).optional(),
  status: z.enum(["submitted", "processing", "completed", "failed"]),
  progress: z.number().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  providerUrls: z.array(z.string().min(1)).optional()
});

export const videoGenerationRecordSchema = z.union([videoGenerationJobSchema, videoGenerationOutputSchema]);

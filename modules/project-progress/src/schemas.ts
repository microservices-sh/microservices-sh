import { z } from "zod";

export const projectStatusSchema = z.enum(["planning", "in_progress", "completed", "on_hold"]);
export const progressCategorySchema = z.enum(["painting", "plumbing", "masonry", "electrical", "carpentry", "general"]);
export const progressMediaTypeSchema = z.enum(["image", "video"]);
export const projectCommentAuthorTypeSchema = z.enum(["customer", "worker", "admin"]);

export const projectProgressConfigSchema = z.object({
  enabled: z.boolean().default(true)
});

export const projectProgressProjectSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  customerId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  location: z.string().nullable(),
  status: projectStatusSchema,
  accessToken: z.string().min(1),
  qrCodeKey: z.string().nullable(),
  startDate: z.string().nullable(),
  expectedEndDate: z.string().nullable(),
  actualEndDate: z.string().nullable(),
  createdById: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const projectAccessGrantSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  userId: z.string().min(1),
  canUpload: z.boolean(),
  canView: z.boolean(),
  createdById: z.string().nullable(),
  createdAt: z.string().min(1)
});

export const progressLogSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  uploaderId: z.string().min(1),
  category: progressCategorySchema,
  description: z.string().nullable(),
  voiceNoteKey: z.string().nullable(),
  capturedAt: z.string().min(1),
  createdAt: z.string().min(1)
});

export const progressMediaFileSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  logId: z.string().min(1),
  storageKey: z.string().min(1),
  thumbnailKey: z.string().nullable(),
  fileType: progressMediaTypeSchema,
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().int().nonnegative(),
  durationSeconds: z.number().int().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  createdAt: z.string().min(1)
});

export const projectCommentSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  logId: z.string().nullable(),
  authorType: projectCommentAuthorTypeSchema,
  authorName: z.string().min(1),
  authorId: z.string().nullable(),
  content: z.string().min(1),
  createdAt: z.string().min(1)
});

export const projectTimelineEntrySchema = z.object({
  log: progressLogSchema,
  media: z.array(progressMediaFileSchema),
  comments: z.array(projectCommentSchema)
});

export const projectProgressSnapshotSchema = z.object({
  project: projectProgressProjectSchema,
  access: z.array(projectAccessGrantSchema),
  timeline: z.array(projectTimelineEntrySchema),
  comments: z.array(projectCommentSchema)
});

export const createProjectInputSchema = z.object({
  customerId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  status: projectStatusSchema.optional(),
  qrCodeKey: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  expectedEndDate: z.string().nullable().optional()
});

export const createProgressLogInputSchema = z.object({
  projectId: z.string().min(1),
  uploaderId: z.string().nullable().optional(),
  category: progressCategorySchema.optional(),
  description: z.string().nullable().optional(),
  voiceNoteKey: z.string().nullable().optional(),
  capturedAt: z.string().nullable().optional()
});

export const updateProjectStatusInputSchema = z.object({
  projectId: z.string().min(1),
  status: projectStatusSchema,
  actualEndDate: z.string().nullable().optional()
});

export const grantProjectAccessInputSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
  canUpload: z.boolean().optional(),
  canView: z.boolean().optional()
});

export const revokeProjectAccessInputSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1)
});

export const attachProgressMediaInputSchema = z.object({
  logId: z.string().min(1),
  storageKey: z.string().min(1),
  thumbnailKey: z.string().nullable().optional(),
  fileType: progressMediaTypeSchema,
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().int().nonnegative(),
  durationSeconds: z.number().int().nonnegative().nullable().optional(),
  width: z.number().int().nonnegative().nullable().optional(),
  height: z.number().int().nonnegative().nullable().optional()
});

export const addProjectCommentInputSchema = z.object({
  projectId: z.string().min(1),
  logId: z.string().nullable().optional(),
  authorType: projectCommentAuthorTypeSchema,
  authorName: z.string().min(1),
  authorId: z.string().nullable().optional(),
  content: z.string().min(1)
});

export const listProjectsInputSchema = z.object({
  customerId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  status: projectStatusSchema.optional(),
  limit: z.number().int().positive().optional()
});

export const projectProgressRecordSchema = z.union([
  projectProgressProjectSchema,
  projectAccessGrantSchema,
  progressLogSchema,
  progressMediaFileSchema,
  projectCommentSchema
]);

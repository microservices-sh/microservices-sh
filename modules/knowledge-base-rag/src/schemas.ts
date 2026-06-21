import { z } from "zod";

export const knowledgeBaseRagConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultSearchLimit: z.number().int().positive().max(50).default(8),
  maxSearchLimit: z.number().int().positive().max(100).default(20),
  minAnswerCitations: z.number().int().positive().max(10).default(1)
});

export const articleSourceTypeSchema = z.enum(["manual", "web_scan", "file_upload", "api_sync"]);
export const articleStatusSchema = z.enum(["active", "archived"]);
export const sourceStatusSchema = z.enum(["pending", "processing", "completed", "failed"]);
export const attachmentTypeSchema = z.enum(["document", "image", "video", "audio"]);
export const processingStatusSchema = z.enum(["pending", "processing", "completed", "failed", "skipped"]);
export const feedTypeSchema = z.enum(["google_sheets", "notion", "airtable", "csv_url"]);
export const syncFrequencySchema = z.enum(["manual", "hourly", "daily", "weekly"]);
export const syncStatusSchema = z.enum(["pending", "syncing", "synced", "failed"]);

export const createArticleInputSchema = z.object({
  tenantId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  title: z.string().min(2).max(200),
  content: z.string().min(20),
  sourceType: articleSourceTypeSchema.default("manual"),
  sourceUrl: z.string().url().nullable().optional()
});

export const updateArticleInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2).max(200).optional(),
  content: z.string().min(20).optional(),
  status: articleStatusSchema.optional(),
  sourceUrl: z.string().url().nullable().optional()
});

export const articleIdSchema = z.object({
  id: z.string().min(1),
});

export const sourceIdSchema = z.object({
  id: z.string().min(1)
});

export const webScanJobIdSchema = z.object({
  id: z.string().min(1)
});

export const knowledgeFeedIdSchema = z.object({
  id: z.string().min(1)
});

export const listArticlesInputSchema = z.object({
  tenantId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  status: z.union([articleStatusSchema, z.literal("all")]).default("active"),
  search: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).optional()
});

export const searchKnowledgeInputSchema = z.object({
  tenantId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  query: z.string().min(2),
  limit: z.number().int().positive().max(100).optional()
});

export const listSourcesInputSchema = z.object({
  tenantId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  status: z.union([sourceStatusSchema, z.literal("all")]).default("all"),
  articleId: z.string().min(1).nullable().optional(),
  attachmentId: z.string().min(1).nullable().optional(),
  limit: z.number().int().positive().max(100).optional()
});

export const listAttachmentsInputSchema = z.object({
  tenantId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  articleId: z.string().min(1).nullable().optional(),
  processingStatus: z.union([processingStatusSchema, z.literal("all")]).default("all"),
  limit: z.number().int().positive().max(100).optional()
});

export const createWebScanJobInputSchema = z.object({
  tenantId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  baseUrl: z.string().url(),
  status: sourceStatusSchema.default("pending")
});

export const updateWebScanJobInputSchema = z.object({
  id: z.string().min(1),
  status: sourceStatusSchema.optional(),
  pagesScanned: z.number().int().nonnegative().optional(),
  articlesCreated: z.number().int().nonnegative().optional(),
  error: z.string().nullable().optional()
});

export const listWebScanJobsInputSchema = z.object({
  tenantId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  status: z.union([sourceStatusSchema, z.literal("all")]).default("all"),
  limit: z.number().int().positive().max(100).optional()
});

export const createKnowledgeFeedInputSchema = z.object({
  tenantId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  feedType: feedTypeSchema,
  name: z.string().min(1).max(200),
  sourceUrl: z.string().url(),
  config: z.record(z.unknown()).default({}),
  syncFrequency: syncFrequencySchema.default("manual"),
  isActive: z.boolean().default(true)
});

export const updateKnowledgeFeedInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  sourceUrl: z.string().url().optional(),
  config: z.record(z.unknown()).optional(),
  syncFrequency: syncFrequencySchema.optional(),
  syncStatus: syncStatusSchema.optional(),
  syncError: z.string().nullable().optional(),
  rowsTotal: z.number().int().nonnegative().optional(),
  articlesCreated: z.number().int().nonnegative().optional(),
  articlesUpdated: z.number().int().nonnegative().optional(),
  articlesDeleted: z.number().int().nonnegative().optional(),
  lastRowHash: z.string().nullable().optional(),
  isActive: z.boolean().optional()
});

export const listKnowledgeFeedsInputSchema = z.object({
  tenantId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  feedType: feedTypeSchema.optional(),
  syncStatus: z.union([syncStatusSchema, z.literal("all")]).default("all"),
  isActive: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional()
});

export const answerQuestionInputSchema = searchKnowledgeInputSchema.extend({
  supportContext: z.string().max(4000).optional()
});

export const draftSupportReplyInputSchema = z.object({
  tenantId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  ticketId: z.string().min(1).nullable().optional(),
  subject: z.string().min(1).max(300),
  description: z.string().min(1).max(8000),
  limit: z.number().int().positive().max(100).optional()
});

export const recordSourceInputSchema = z.object({
  tenantId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  sourceType: articleSourceTypeSchema,
  sourceName: z.string().min(1).max(200),
  sourceUrl: z.string().url().nullable().optional(),
  status: sourceStatusSchema.default("pending"),
  errorMessage: z.string().nullable().optional(),
  articleId: z.string().min(1).nullable().optional(),
  attachmentId: z.string().min(1).nullable().optional(),
  fileSizeBytes: z.number().int().nonnegative().nullable().optional(),
  contentType: z.string().min(1).nullable().optional()
});

export const attachArticleFileInputSchema = z.object({
  tenantId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  articleId: z.string().min(1).nullable().optional(),
  filename: z.string().min(1).max(255),
  originalFilename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  storageKey: z.string().min(1),
  attachmentType: attachmentTypeSchema,
  extractedText: z.string().nullable().optional(),
  transcription: z.string().nullable().optional(),
  imageDescription: z.string().nullable().optional(),
  processingStatus: processingStatusSchema.default("pending"),
  processingError: z.string().nullable().optional()
});

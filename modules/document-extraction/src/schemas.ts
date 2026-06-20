import { z } from "zod";

export const extractionModeSchema = z.enum(["local-only", "gateway-only", "hybrid", "sidecar"]);
export const extractionRuntimeSchema = z.enum(["browser-ocr", "browser-local-llm", "ai-gateway", "sidecar"]);
export const extractionStatusSchema = z.enum(["pending", "extracting", "needs_review", "approved", "rejected", "failed"]);
export const extractionTargetTypeSchema = z.enum(["invoice", "receipt", "intake-form", "customer-document", "support-evidence", "custom"]);

export const documentExtractionConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mode: extractionModeSchema.default("hybrid"),
  reviewRequired: z.boolean().default(true),
  minConfidenceForApproval: z.number().min(0).max(1).default(0.85),
  localBrowser: z.object({
    enabled: z.boolean().default(true),
    downloadOnDemand: z.boolean().default(true),
    maxPages: z.number().int().positive().max(25).default(3)
  }).default({ enabled: true, downloadOnDemand: true, maxPages: 3 }),
  gatewayFallback: z.object({
    enabled: z.boolean().default(true),
    requiresApproval: z.boolean().default(true),
    minConfidence: z.number().min(0).max(1).default(0.85)
  }).default({ enabled: true, requiresApproval: true, minConfidence: 0.85 }),
  sidecar: z.object({
    enabled: z.boolean().default(false),
    endpoint: z.string().url().nullable().default(null)
  }).default({ enabled: false, endpoint: null })
});

export const sourceRegionSchema = z.object({
  page: z.number().int().positive().optional(),
  text: z.string().optional(),
  boundingBoxes: z.array(z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  })).optional()
});

const extractedValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const extractedFieldSchema = z.object({
  name: z.string().min(1),
  value: extractedValueSchema,
  confidence: z.number().min(0).max(1),
  source: sourceRegionSchema.optional(),
  needsReview: z.boolean().optional()
});

export const extractedTableSchema = z.object({
  name: z.string().min(1),
  columns: z.array(z.string().min(1)),
  rows: z.array(z.record(z.string(), extractedValueSchema)),
  confidence: z.number().min(0).max(1),
  source: sourceRegionSchema.optional()
});

export const documentReferenceSchema = z.object({
  fileId: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
  mimeType: z.string().min(1),
  originalName: z.string().min(1).max(255).optional(),
  bytes: z.number().int().nonnegative().optional(),
  pageCount: z.number().int().positive().optional(),
  sha256: z.string().min(16).optional()
}).refine((value) => Boolean(value.fileId || value.key), {
  message: "Either fileId or key is required."
});

export const extractionDraftSchema = z.object({
  schemaId: z.string().min(1),
  targetType: extractionTargetTypeSchema,
  fields: z.array(extractedFieldSchema).default([]),
  tables: z.array(extractedTableSchema).default([]),
  rawText: z.string().optional(),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1),
  runtime: extractionRuntimeSchema,
  model: z.string().optional(),
  warnings: z.array(z.string()).default([])
});

const targetRecordSchema = z.object({
  moduleId: z.string().min(1),
  recordId: z.string().min(1)
});

export const extractionReviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reviewerId: z.string().min(1),
  notes: z.string().optional(),
  targetRecord: targetRecordSchema.optional(),
  reviewedAt: z.string().min(1)
});

export const documentExtractionJobSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  ownerId: z.string().min(1).nullable(),
  status: extractionStatusSchema,
  targetType: extractionTargetTypeSchema,
  schemaId: z.string().min(1),
  requestedMode: extractionModeSchema,
  selectedRuntime: extractionRuntimeSchema.nullable(),
  source: documentReferenceSchema,
  draft: extractionDraftSchema.nullable(),
  approvedOutput: z.record(z.string(), z.unknown()).nullable(),
  review: extractionReviewSchema.nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  error: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const documentExtractionRecordSchema = documentExtractionJobSchema;

export const createExtractionJobInputSchema = z.object({
  tenantId: z.string().min(1),
  ownerId: z.string().min(1).nullable().optional(),
  source: documentReferenceSchema,
  targetType: extractionTargetTypeSchema.default("custom"),
  schemaId: z.string().min(1).default("default"),
  requestedMode: extractionModeSchema.default("hybrid"),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const submitExtractionDraftInputSchema = z.object({
  jobId: z.string().min(1),
  tenantId: z.string().min(1),
  draft: extractionDraftSchema
});

export const reviewExtractionInputSchema = z.object({
  jobId: z.string().min(1),
  tenantId: z.string().min(1),
  reviewerId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().optional(),
  approvedOutput: z.record(z.string(), z.unknown()).optional(),
  targetRecord: targetRecordSchema.optional()
});

export const listExtractionJobsInputSchema = z.object({
  tenantId: z.string().min(1),
  ownerId: z.string().min(1).nullable().optional(),
  status: extractionStatusSchema.optional(),
  limit: z.number().int().positive().max(500).default(100)
});

export const getExtractionJobInputSchema = z.object({
  jobId: z.string().min(1),
  tenantId: z.string().min(1)
});

export const normalizeExtractionInputSchema = z.object({
  tenantId: z.string().min(1),
  schemaId: z.string().min(1),
  targetType: extractionTargetTypeSchema,
  runtime: extractionRuntimeSchema,
  rawText: z.string().min(1),
  documentName: z.string().optional(),
  fieldsHint: z.array(z.string().min(1)).optional()
});

export type CreateExtractionJobInput = z.input<typeof createExtractionJobInputSchema>;
export type SubmitExtractionDraftInput = z.input<typeof submitExtractionDraftInputSchema>;
export type ReviewExtractionInput = z.input<typeof reviewExtractionInputSchema>;
export type ListExtractionJobsInput = z.input<typeof listExtractionJobsInputSchema>;
export type GetExtractionJobInput = z.input<typeof getExtractionJobInputSchema>;
export type NormalizeExtractionInput = z.input<typeof normalizeExtractionInputSchema>;

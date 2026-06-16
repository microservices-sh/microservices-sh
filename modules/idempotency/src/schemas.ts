import { z } from "zod";

export const idempotencyConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultTtlMs: z.number().int().positive().max(31_536_000_000).default(86_400_000),
  defaultLockTtlMs: z.number().int().positive().max(3_600_000).default(60_000),
  maxTtlMs: z.number().int().positive().max(31_536_000_000).default(31_536_000_000)
});

export const idempotencyRecordSchema = z.object({
  id: z.string().min(1),
  scope: z.string().min(1).max(120),
  key: z.string().min(1).max(512),
  requestHash: z.string().min(1).max(512).nullable(),
  status: z.enum(["in_progress", "completed", "failed"]),
  response: z.record(z.string(), z.unknown()).nullable(),
  error: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  statusCode: z.number().int().min(100).max(599).nullable(),
  lockedUntil: z.string().datetime().nullable(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable()
});

export const claimIdempotencyInputSchema = z.object({
  scope: z.string().min(1).max(120),
  key: z.string().min(1).max(512),
  requestHash: z.string().min(1).max(512).optional().nullable(),
  ttlMs: z.number().int().positive().max(31_536_000_000).optional(),
  lockTtlMs: z.number().int().positive().max(3_600_000).optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const completeIdempotencyInputSchema = z.object({
  scope: z.string().min(1).max(120),
  key: z.string().min(1).max(512),
  response: z.record(z.string(), z.unknown()).default({}),
  statusCode: z.number().int().min(100).max(599).default(200),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const failIdempotencyInputSchema = z.object({
  scope: z.string().min(1).max(120),
  key: z.string().min(1).max(512),
  error: z.record(z.string(), z.unknown()).default({}),
  statusCode: z.number().int().min(100).max(599).default(500),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const getIdempotencyRecordInputSchema = z.object({
  scope: z.string().min(1).max(120),
  key: z.string().min(1).max(512)
});

export const pruneExpiredRecordsInputSchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.number().int().positive().max(1000).default(100)
});

export type IdempotencyConfigInput = z.infer<typeof idempotencyConfigSchema>;
export type ClaimIdempotencyInput = z.infer<typeof claimIdempotencyInputSchema>;
export type CompleteIdempotencyInput = z.infer<typeof completeIdempotencyInputSchema>;
export type FailIdempotencyInput = z.infer<typeof failIdempotencyInputSchema>;

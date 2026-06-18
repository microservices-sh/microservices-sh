import { z } from "zod";

export const operatorTaskStatusSchema = z.enum(["todo", "in-progress", "done"]);
export const operatorTaskPrioritySchema = z.enum(["High", "Medium", "Low"]);
export const operatorTaskSourceSchema = z.enum(["manual", "agent", "calendar", "inbox"]);
export const focusBlockSourceSchema = z.enum(["manual", "ai-draft", "calendar"]);
export const focusEnergySchema = z.enum(["Deep", "Review", "Comms", "Admin", "Close"]);
export const dailyReviewStatusSchema = z.enum(["draft", "saved"]);

const actorId = z.string().trim().min(1).max(160).optional().nullable();
const source = z.string().trim().min(1).max(120).optional();
const orgId = z.string().trim().min(1).max(160);
const id = z.string().trim().min(1).max(160).optional();
const date = z.string().trim().min(4).max(40);

export const operatorSubtaskInputSchema = z.object({
  id,
  text: z.string().trim().min(1).max(240),
  done: z.coerce.boolean().default(false)
});

export const listOperatorTasksInputSchema = z.object({
  orgId,
  status: operatorTaskStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const upsertOperatorTaskInputSchema = z.object({
  id,
  orgId,
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().max(1000).default(""),
  status: operatorTaskStatusSchema.default("todo"),
  category: z.string().trim().min(1).max(80).default("Ops"),
  priority: operatorTaskPrioritySchema.default("Medium"),
  dueLabel: z.string().trim().min(1).max(80).default("Today"),
  source: operatorTaskSourceSchema.default("manual"),
  actorId,
  sourceLabel: source,
  subtasks: z.array(operatorSubtaskInputSchema).default([])
});

export const updateOperatorTaskStatusInputSchema = z.object({
  orgId,
  taskId: z.string().trim().min(1).max(160),
  status: operatorTaskStatusSchema,
  actorId,
  sourceLabel: source
});

export const listFocusBlocksInputSchema = z.object({
  orgId,
  date: date.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const upsertFocusBlockInputSchema = z.object({
  id,
  orgId,
  date,
  timeRange: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  energy: focusEnergySchema.default("Deep"),
  note: z.string().trim().max(1000).default(""),
  source: focusBlockSourceSchema.default("manual"),
  actorId,
  sourceLabel: source
});

export const listDailyReviewsInputSchema = z.object({
  orgId,
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export const saveDailyReviewInputSchema = z.object({
  id,
  orgId,
  date,
  shipped: z.string().trim().max(4000).default(""),
  openLoops: z.string().trim().max(4000).default(""),
  agentHandoffs: z.string().trim().max(4000).default(""),
  tomorrowFirstMove: z.string().trim().max(1000).default(""),
  markdown: z.string().trim().max(12000).optional(),
  status: dailyReviewStatusSchema.default("saved"),
  actorId,
  sourceLabel: source
});

export const operatorWorkbenchInputSchema = z.object({
  orgId,
  date: date.optional()
});

export const operatorWorkConfigSchema = z.object({
  maxTasks: z.number().int().min(1).default(100),
  allowAgentDrafts: z.boolean().default(true),
  requireReviewBeforeUnlock: z.boolean().default(true)
});

export type ListOperatorTasksInput = z.infer<typeof listOperatorTasksInputSchema>;
export type UpsertOperatorTaskInput = z.infer<typeof upsertOperatorTaskInputSchema>;
export type UpdateOperatorTaskStatusInput = z.infer<typeof updateOperatorTaskStatusInputSchema>;
export type ListFocusBlocksInput = z.infer<typeof listFocusBlocksInputSchema>;
export type UpsertFocusBlockInput = z.infer<typeof upsertFocusBlockInputSchema>;
export type ListDailyReviewsInput = z.infer<typeof listDailyReviewsInputSchema>;
export type SaveDailyReviewInput = z.infer<typeof saveDailyReviewInputSchema>;
export type OperatorWorkbenchInput = z.infer<typeof operatorWorkbenchInputSchema>;
export type OperatorWorkConfig = z.infer<typeof operatorWorkConfigSchema>;

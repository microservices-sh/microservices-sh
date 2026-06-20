import { z } from "zod";

export const dispatchAgentRunInputSchema = z.object({
  ownerId: z.string().min(1),
  workflowRunId: z.string().min(1),
  stepRunId: z.string().min(1),
  agentTemplateId: z.string().min(1),
  runtimeKind: z.enum(["tool-only", "hermes-fly", "fly-machine", "vercel-sandbox", "research-runtime", "custom"]),
  input: z.record(z.string(), z.unknown()).default({}),
  allowedTools: z.array(z.string().min(1)).default([]),
  allowedResources: z.array(z.string().min(1)).default([]),
  ttlMs: z.number().int().positive().max(86_400_000).default(3_600_000)
});

export const resumeAgentRunInputSchema = z.object({
  ownerId: z.string().min(1),
  agentRunId: z.string().min(1),
  resumeToken: z.string().min(32),
  status: z.enum(["succeeded", "failed", "canceled", "timed_out"]),
  output: z.record(z.string(), z.unknown()).default({}),
  error: z.string().min(1).optional(),
  contextPatch: z.record(z.string(), z.unknown()).default({})
});

export const cancelAgentRunInputSchema = z.object({
  ownerId: z.string().min(1),
  agentRunId: z.string().min(1)
});

export type DispatchAgentRunInput = z.infer<typeof dispatchAgentRunInputSchema>;
export type ResumeAgentRunInput = z.infer<typeof resumeAgentRunInputSchema>;
export type CancelAgentRunInput = z.infer<typeof cancelAgentRunInputSchema>;

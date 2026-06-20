import { z } from "zod";

export const enqueueJobInputSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  // When set, enqueue is idempotent across retries/redeliveries.
  idempotencyKey: z.string().min(1).optional().nullable(),
  maxAttempts: z.number().int().positive().max(50).default(5),
  // Delay before the job is first eligible to run.
  delayMs: z.number().int().nonnegative().max(31_536_000_000).default(0)
});

export const upsertScheduleInputSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  intervalMs: z.number().int().positive().max(31_536_000_000),
  maxAttempts: z.number().int().positive().max(50).default(5),
  // First fire time; defaults to now + intervalMs when omitted.
  firstRunAt: z.iso.datetime().optional()
});

export const listJobsFilterSchema = z.object({
  status: z.enum(["pending", "running", "succeeded", "dead"]).optional(),
  type: z.string().optional(),
  limit: z.number().int().positive().max(500).default(100)
});

export const workflowStepDefinitionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["tool", "agent", "approval", "condition", "wait", "emit"]),
  name: z.string().min(1).optional(),
  ref: z.string().min(1).optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  maxAttempts: z.number().int().positive().max(50).default(3),
  next: z.string().min(1).nullable().default(null),
  onSuccess: z.string().min(1).nullable().default(null),
  onFailure: z.string().min(1).nullable().default(null)
});

function validateWorkflowEdges(
  value: { steps: Array<{ id: string; next: string | null; onSuccess: string | null; onFailure: string | null }> },
  ctx: z.RefinementCtx
) {
  const ids = new Set<string>();
  const indexById = new Map<string, number>();
  value.steps.forEach((step, index) => {
    if (ids.has(step.id)) {
      ctx.addIssue({ code: "custom", path: ["steps", index, "id"], message: "Step ids must be unique." });
    }
    ids.add(step.id);
    indexById.set(step.id, index);
  });

  const edges = new Map<string, string[]>();
  value.steps.forEach((step, index) => {
    const targets: string[] = [];
    (["next", "onSuccess", "onFailure"] as const).forEach((field) => {
      const target = step[field];
      if (target && !ids.has(target)) {
        ctx.addIssue({ code: "custom", path: ["steps", index, field], message: `Unknown step id "${target}".` });
      }
      if (target) targets.push(target);
    });
    edges.set(step.id, targets);
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();
  let cycleReported = false;
  const visit = (id: string): void => {
    if (cycleReported || visited.has(id)) return;
    if (visiting.has(id)) {
      const index = indexById.get(id) ?? 0;
      ctx.addIssue({ code: "custom", path: ["steps", index, "id"], message: "Workflow steps must form an acyclic graph." });
      cycleReported = true;
      return;
    }
    visiting.add(id);
    for (const target of edges.get(id) ?? []) {
      if (ids.has(target)) visit(target);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
}

export const defineWorkflowInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    ownerId: z.string().min(1),
    name: z.string().min(1),
    version: z.number().int().positive().default(1),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    trigger: z.record(z.string(), z.unknown()).nullable().default(null),
    steps: z.array(workflowStepDefinitionSchema).min(1)
  })
  .superRefine(validateWorkflowEdges);

export const startWorkflowRunInputSchema = z.object({
  ownerId: z.string().min(1),
  definitionId: z.string().min(1),
  trigger: z.record(z.string(), z.unknown()).default({}),
  input: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().min(1).optional().nullable()
});

export const resumeWorkflowStepInputSchema = z.object({
  ownerId: z.string().min(1),
  workflowRunId: z.string().min(1),
  stepId: z.string().min(1).optional(),
  status: z.enum(["succeeded", "failed"]),
  output: z.record(z.string(), z.unknown()).default({}),
  error: z.string().min(1).optional(),
  nextStepId: z.string().min(1).nullable().optional(),
  contextPatch: z.record(z.string(), z.unknown()).default({})
});

export const recordWorkflowArtifactInputSchema = z.object({
  ownerId: z.string().min(1),
  workflowRunId: z.string().min(1),
  stepRunId: z.string().min(1).optional().nullable(),
  kind: z.enum(["json", "text", "file", "url", "diff", "log", "image", "other"]),
  name: z.string().min(1),
  uri: z.string().min(1).optional().nullable(),
  content: z.union([z.record(z.string(), z.unknown()), z.string()]).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const appendWorkflowStepEventInputSchema = z.object({
  ownerId: z.string().min(1),
  workflowRunId: z.string().min(1),
  stepRunId: z.string().min(1).optional().nullable(),
  stepId: z.string().min(1).optional().nullable(),
  name: z.enum([
    "workflow.step.claimed",
    "workflow.step.waiting",
    "workflow.step.resumed",
    "workflow.step.artifact_recorded",
    "workflow.step.runtime_event",
    "workflow.step.canceled",
    "workflow.step.timed_out"
  ]),
  payload: z.record(z.string(), z.unknown()).default({})
});

export type EnqueueJobInput = z.infer<typeof enqueueJobInputSchema>;
export type UpsertScheduleInput = z.infer<typeof upsertScheduleInputSchema>;
export type ListJobsFilter = z.infer<typeof listJobsFilterSchema>;
export type DefineWorkflowInput = z.infer<typeof defineWorkflowInputSchema>;
export type StartWorkflowRunInput = z.infer<typeof startWorkflowRunInputSchema>;
export type ResumeWorkflowStepInput = z.infer<typeof resumeWorkflowStepInputSchema>;
export type RecordWorkflowArtifactInput = z.infer<typeof recordWorkflowArtifactInputSchema>;
export type AppendWorkflowStepEventInput = z.infer<typeof appendWorkflowStepEventInputSchema>;

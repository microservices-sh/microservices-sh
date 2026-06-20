import type {
  WorkflowRun,
  WorkflowStepDefinition,
  WorkflowStepHandlerRegistry,
  WorkflowStepResult,
  WorkflowStepRun
} from "../types";

export function findWorkflowStep(run: WorkflowRun, stepId: string): WorkflowStepDefinition | null {
  return run.stepDefinitions.find((step) => step.id === stepId) ?? null;
}

export function buildWorkflowStepInput(
  run: WorkflowRun,
  step: WorkflowStepDefinition
): Record<string, unknown> {
  return {
    workflowInput: { ...run.input },
    context: { ...run.context },
    stepInput: { ...step.input }
  };
}

export function createPendingWorkflowStepRun(
  run: WorkflowRun,
  step: WorkflowStepDefinition,
  nowIso: string
): WorkflowStepRun {
  return {
    id: "wfsr_" + crypto.randomUUID().slice(0, 16),
    ownerId: run.ownerId,
    workflowRunId: run.id,
    stepId: step.id,
    kind: step.kind,
    status: "pending",
    attempt: 0,
    maxAttempts: step.maxAttempts,
    input: buildWorkflowStepInput(run, step),
    output: null,
    error: null,
    runAt: nowIso,
    startedAt: null,
    finishedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

export function workflowHandlerKeys(step: WorkflowStepDefinition): string[] {
  const keys = new Set<string>();
  if (step.ref) {
    keys.add(`${step.kind}:${step.ref}`);
    keys.add(step.ref);
  }
  keys.add(step.kind);
  return [...keys];
}

export function findWorkflowHandler(step: WorkflowStepDefinition, handlers: WorkflowStepHandlerRegistry) {
  for (const key of workflowHandlerKeys(step)) {
    const handler = handlers[key];
    if (handler) return handler;
  }
  return null;
}

export interface NormalizedWorkflowStepResult {
  status: "succeeded" | "waiting" | "failed";
  output: Record<string, unknown>;
  error: string;
  nextStepId: string | null | undefined;
  contextPatch: Record<string, unknown>;
}

export function normalizeWorkflowStepResult(result: void | WorkflowStepResult): NormalizedWorkflowStepResult {
  return {
    status: result?.status ?? (result?.error ? "failed" : "succeeded"),
    output: result?.output ?? {},
    error: result?.error ?? "",
    nextStepId: result && "nextStepId" in result ? result.nextStepId ?? null : undefined,
    contextPatch: result?.contextPatch ?? {}
  };
}

export function resolveNextStepId(
  step: WorkflowStepDefinition,
  nextStepId: string | null | undefined,
  outcome: "succeeded" | "failed"
): string | null {
  if (nextStepId !== undefined) return nextStepId;
  if (outcome === "failed") return step.onFailure;
  return step.onSuccess ?? step.next;
}

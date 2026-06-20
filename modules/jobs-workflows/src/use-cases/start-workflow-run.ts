import { ok, err } from "@microservices-sh/connection-contract";
import { jobsWorkflowsMeta } from "../meta";
import type { WorkflowDefinitionStore, WorkflowRunStore, WorkflowStepRunStore } from "../ports";
import { startWorkflowRunInputSchema } from "../schemas";
import type { DomainEvent, WorkflowRun } from "../types";
import { createPendingWorkflowStepRun } from "./workflow-helpers";

export async function startWorkflowRun(
  input: unknown,
  deps: {
    definitionStore: WorkflowDefinitionStore;
    runStore: WorkflowRunStore;
    stepRunStore: WorkflowStepRunStore;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = jobsWorkflowsMeta(deps);
  const parsed = startWorkflowRunInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "jobs-workflows.INVALID_WORKFLOW_RUN_INPUT", message: "Workflow run input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  if (parsed.data.idempotencyKey) {
    const existing = await deps.runStore.findByIdempotencyKey(parsed.data.ownerId, parsed.data.idempotencyKey);
    if (existing) {
      return ok(200, { run: existing, firstStepRun: null, deduped: true }, meta);
    }
  }

  const definition = await deps.definitionStore.get(parsed.data.definitionId);
  if (!definition || definition.ownerId !== parsed.data.ownerId) {
    return err(
      404,
      { code: "jobs-workflows.WORKFLOW_DEFINITION_NOT_FOUND", message: `No workflow definition ${parsed.data.definitionId}.` },
      meta
    );
  }

  if (definition.status !== "active") {
    return err(
      409,
      {
        code: "jobs-workflows.WORKFLOW_DEFINITION_INACTIVE",
        message: `Workflow definition ${definition.id} is ${definition.status}, not active.`
      },
      meta
    );
  }

  const firstStep = definition.steps[0];
  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const run: WorkflowRun = {
    id: "wfr_" + crypto.randomUUID().slice(0, 16),
    ownerId: definition.ownerId,
    definitionId: definition.id,
    definitionVersion: definition.version,
    status: "running",
    trigger: parsed.data.trigger,
    input: parsed.data.input,
    context: {},
    currentStepId: firstStep.id,
    idempotencyKey: parsed.data.idempotencyKey ?? null,
    stepDefinitions: definition.steps.map((step) => ({ ...step, input: { ...step.input } })),
    createdAt: nowIso,
    updatedAt: nowIso,
    finishedAt: null
  };
  const firstStepRun = createPendingWorkflowStepRun(run, firstStep, nowIso);

  try {
    await deps.runStore.insert(run);
  } catch (e) {
    if (parsed.data.idempotencyKey) {
      const existing = await deps.runStore.findByIdempotencyKey(parsed.data.ownerId, parsed.data.idempotencyKey);
      if (existing) return ok(200, { run: existing, firstStepRun: null, deduped: true }, meta);
    }
    throw e;
  }

  try {
    await deps.stepRunStore.insert(firstStepRun);
  } catch (e) {
    run.status = "failed";
    run.currentStepId = null;
    run.updatedAt = nowIso;
    run.finishedAt = nowIso;
    await deps.runStore.update(run);
    return err(
      500,
      {
        code: "jobs-workflows.WORKFLOW_START_FAILED",
        message: "Workflow run was created, but its first step could not be created.",
        cause: e instanceof Error ? e.message : String(e)
      },
      meta
    );
  }

  const event: DomainEvent = {
    name: "workflow.started",
    correlationId: meta.correlationId,
    payload: {
      id: run.id,
      ownerId: run.ownerId,
      definitionId: run.definitionId,
      currentStepId: run.currentStepId
    }
  };

  return ok(201, { run, firstStepRun, deduped: false, event }, meta);
}

import { ok, err } from "@microservices-sh/connection-contract";
import { computeBackoffMs } from "../backoff";
import { jobsWorkflowsMeta } from "../meta";
import type { WorkflowRunStore, WorkflowStepRunStore } from "../ports";
import type { DomainEvent, WorkflowRun, WorkflowStepDefinition, WorkflowStepHandlerRegistry, WorkflowStepRun } from "../types";
import {
  createPendingWorkflowStepRun,
  findWorkflowHandler,
  findWorkflowStep,
  normalizeWorkflowStepResult,
  resolveNextStepId
} from "./workflow-helpers";

async function createNextStepRun(
  run: WorkflowRun,
  step: WorkflowStepDefinition,
  nowIso: string,
  stepRunStore: WorkflowStepRunStore
) {
  const existing = await stepRunStore.getForOwnerRunStep(run.ownerId, run.id, step.id);
  if (existing) return existing;
  const nextStepRun = createPendingWorkflowStepRun(run, step, nowIso);
  await stepRunStore.insert(nextStepRun);
  return nextStepRun;
}

function workflowEvent(
  name: DomainEvent["name"],
  correlationId: string,
  run: WorkflowRun,
  stepRun?: WorkflowStepRun
): DomainEvent {
  return {
    name,
    correlationId,
    payload: {
      id: run.id,
      ownerId: run.ownerId,
      definitionId: run.definitionId,
      currentStepId: run.currentStepId,
      stepId: stepRun?.stepId,
      attempt: stepRun?.attempt
    }
  };
}

export async function runNextWorkflowStep(
  workflowRunId: string,
  handlers: WorkflowStepHandlerRegistry,
  deps: {
    ownerId: string;
    runStore: WorkflowRunStore;
    stepRunStore: WorkflowStepRunStore;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = jobsWorkflowsMeta(deps);
  const nowMs = deps.now?.() ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const run = await deps.runStore.getForOwner(deps.ownerId, workflowRunId);
  if (!run) {
    return err(404, { code: "jobs-workflows.WORKFLOW_RUN_NOT_FOUND", message: `No workflow run ${workflowRunId}.` }, meta);
  }

  if (run.status === "succeeded" || run.status === "failed" || run.status === "canceled") {
    return ok(200, { run, skipped: true }, meta);
  }

  if (!run.currentStepId) {
    run.status = "succeeded";
    run.updatedAt = nowIso;
    run.finishedAt = nowIso;
    await deps.runStore.update(run);
    return ok(200, { run, event: workflowEvent("workflow.succeeded", meta.correlationId, run) }, meta);
  }

  const step = findWorkflowStep(run, run.currentStepId);
  if (!step) {
    run.status = "failed";
    run.updatedAt = nowIso;
    run.finishedAt = nowIso;
    await deps.runStore.update(run);
    return err(
      500,
      { code: "jobs-workflows.WORKFLOW_STEP_NOT_FOUND", message: `Workflow step ${run.currentStepId} is not in the run snapshot.` },
      meta
    );
  }

  let stepRun = await deps.stepRunStore.getForOwnerRunStep(run.ownerId, run.id, step.id);
  if (!stepRun) {
    stepRun = createPendingWorkflowStepRun(run, step, nowIso);
    try {
      await deps.stepRunStore.insert(stepRun);
    } catch {
      const existing = await deps.stepRunStore.getForOwnerRunStep(run.ownerId, run.id, step.id);
      if (!existing) throw new Error(`Unable to create workflow step run ${step.id}.`);
      stepRun = existing;
    }
  }

  if (stepRun.status === "waiting") {
    run.status = "waiting";
    run.updatedAt = nowIso;
    await deps.runStore.update(run);
    return ok(200, { run, stepRun, skipped: true, event: workflowEvent("workflow.waiting", meta.correlationId, run, stepRun) }, meta);
  }

  if (stepRun.status === "succeeded" || stepRun.status === "dead" || stepRun.status === "skipped") {
    return ok(200, { run, stepRun, skipped: true }, meta);
  }

  if (stepRun.status === "running") {
    return ok(200, { run, stepRun, skipped: true, claimed: false }, meta);
  }

  if (Date.parse(stepRun.runAt) > nowMs) {
    run.status = "waiting";
    run.updatedAt = nowIso;
    await deps.runStore.update(run);
    return ok(200, { run, stepRun, retryAt: stepRun.runAt, event: workflowEvent("workflow.waiting", meta.correlationId, run, stepRun) }, meta);
  }

  const handler = findWorkflowHandler(step, handlers);
  if (!handler) {
    return err(
      404,
      {
        code: "jobs-workflows.WORKFLOW_STEP_HANDLER_NOT_FOUND",
        message: `No handler registered for workflow step ${step.kind}${step.ref ? `:${step.ref}` : ""}.`
      },
      meta
    );
  }

  const claimed = await deps.stepRunStore.claimPending(run.ownerId, run.id, step.id, nowIso);
  if (!claimed) {
    const current = await deps.stepRunStore.getForOwnerRunStep(run.ownerId, run.id, step.id);
    return ok(200, { run, stepRun: current ?? stepRun, skipped: true, claimed: false }, meta);
  }

  stepRun = claimed;
  const attempt = stepRun.attempt;
  run.status = "running";
  run.updatedAt = nowIso;
  await deps.runStore.update(run);

  let result;
  try {
    result = await handler(stepRun.input, {
      workflowRun: run,
      stepRun,
      step,
      correlationId: meta.correlationId,
      now: deps.now ?? Date.now
    });
  } catch (e) {
    result = {
      status: "failed" as const,
      error: e instanceof Error ? e.message : String(e)
    };
  }

  const finishedMs = deps.now?.() ?? Date.now();
  const finishedAt = new Date(finishedMs).toISOString();
  const normalized = normalizeWorkflowStepResult(result);

  if (normalized.status === "waiting") {
    stepRun.status = "waiting";
    stepRun.output = normalized.output;
    stepRun.error = normalized.error || null;
    stepRun.updatedAt = finishedAt;
    run.status = "waiting";
    run.context = { ...run.context, ...normalized.contextPatch };
    run.updatedAt = finishedAt;
    await deps.stepRunStore.update(stepRun);
    await deps.runStore.update(run);
    return ok(200, { run, stepRun, event: workflowEvent("workflow.waiting", meta.correlationId, run, stepRun) }, meta);
  }

  if (normalized.status === "failed") {
    const message = normalized.error || "Workflow step failed.";
    stepRun.error = message;
    stepRun.output = normalized.output;
    stepRun.finishedAt = finishedAt;
    stepRun.updatedAt = finishedAt;

    if (attempt < stepRun.maxAttempts) {
      const retryInMs = computeBackoffMs(attempt);
      stepRun.status = "pending";
      stepRun.runAt = new Date(finishedMs + retryInMs).toISOString();
      run.status = "waiting";
      run.updatedAt = finishedAt;
      await deps.stepRunStore.update(stepRun);
      await deps.runStore.update(run);
      return ok(
        200,
        { run, stepRun, status: "waiting" as const, retryInMs, event: workflowEvent("workflow.waiting", meta.correlationId, run, stepRun) },
        meta
      );
    }

    const failureNextStepId = resolveNextStepId(step, normalized.nextStepId, "failed");
    if (failureNextStepId) {
      const nextStep = findWorkflowStep(run, failureNextStepId);
      if (!nextStep) {
        stepRun.status = "dead";
        run.status = "failed";
        run.currentStepId = null;
        run.updatedAt = finishedAt;
        run.finishedAt = finishedAt;
        await deps.stepRunStore.update(stepRun);
        await deps.runStore.update(run);
        return err(
          500,
          { code: "jobs-workflows.WORKFLOW_STEP_NOT_FOUND", message: `Workflow failure target ${failureNextStepId} is not in the run snapshot.` },
          meta
        );
      }
      stepRun.status = "failed";
      run.context = { ...run.context, ...normalized.contextPatch };
      run.status = "running";
      run.currentStepId = nextStep.id;
      run.updatedAt = finishedAt;
      await deps.stepRunStore.update(stepRun);
      await deps.runStore.update(run);
      const nextStepRun = await createNextStepRun(run, nextStep, finishedAt, deps.stepRunStore);
      return ok(200, { run, stepRun, nextStepRun, event: workflowEvent("workflow.step.failed", meta.correlationId, run, stepRun) }, meta);
    }

    stepRun.status = "dead";
    run.status = "failed";
    run.currentStepId = null;
    run.updatedAt = finishedAt;
    run.finishedAt = finishedAt;
    await deps.stepRunStore.update(stepRun);
    await deps.runStore.update(run);
    return ok(200, {
      run,
      stepRun,
      status: "failed" as const,
      error: message,
      event: workflowEvent("workflow.failed", meta.correlationId, run, stepRun)
    }, meta);
  }

  stepRun.status = "succeeded";
  stepRun.output = normalized.output;
  stepRun.error = null;
  stepRun.finishedAt = finishedAt;
  stepRun.updatedAt = finishedAt;
  run.context = { ...run.context, ...normalized.contextPatch };

  const nextStepId = resolveNextStepId(step, normalized.nextStepId, "succeeded");
  if (!nextStepId) {
    run.status = "succeeded";
    run.currentStepId = null;
    run.updatedAt = finishedAt;
    run.finishedAt = finishedAt;
    await deps.stepRunStore.update(stepRun);
    await deps.runStore.update(run);
    return ok(200, { run, stepRun, event: workflowEvent("workflow.succeeded", meta.correlationId, run, stepRun) }, meta);
  }

  const nextStep = findWorkflowStep(run, nextStepId);
  if (!nextStep) {
    stepRun.status = "dead";
    stepRun.error = `Workflow success target ${nextStepId} is not in the run snapshot.`;
    run.status = "failed";
    run.currentStepId = null;
    run.updatedAt = finishedAt;
    run.finishedAt = finishedAt;
    await deps.stepRunStore.update(stepRun);
    await deps.runStore.update(run);
    return err(
      500,
      { code: "jobs-workflows.WORKFLOW_STEP_NOT_FOUND", message: stepRun.error },
      meta
    );
  }

  run.status = "running";
  run.currentStepId = nextStep.id;
  run.updatedAt = finishedAt;
  await deps.stepRunStore.update(stepRun);
  await deps.runStore.update(run);
  const nextStepRun = await createNextStepRun(run, nextStep, finishedAt, deps.stepRunStore);

  return ok(200, { run, stepRun, nextStepRun, event: workflowEvent("workflow.step.succeeded", meta.correlationId, run, stepRun) }, meta);
}

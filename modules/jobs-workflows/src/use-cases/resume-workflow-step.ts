import { ok, err } from "@microservices-sh/connection-contract";
import { jobsWorkflowsMeta } from "../meta";
import type { WorkflowRunStore, WorkflowStepRunStore } from "../ports";
import { resumeWorkflowStepInputSchema } from "../schemas";
import type { DomainEvent, WorkflowRun, WorkflowStepRun } from "../types";
import {
  createPendingWorkflowStepRun,
  findWorkflowStep,
  resolveNextStepId
} from "./workflow-helpers";

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

export async function resumeWorkflowStep(
  input: unknown,
  deps: {
    runStore: WorkflowRunStore;
    stepRunStore: WorkflowStepRunStore;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = jobsWorkflowsMeta(deps);
  const parsed = resumeWorkflowStepInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "jobs-workflows.INVALID_WORKFLOW_STEP_RESUME", message: "Workflow step resume input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const run = await deps.runStore.getForOwner(parsed.data.ownerId, parsed.data.workflowRunId);
  if (!run) {
    return err(
      404,
      { code: "jobs-workflows.WORKFLOW_RUN_NOT_FOUND", message: `No workflow run ${parsed.data.workflowRunId}.` },
      meta
    );
  }

  if (!run.currentStepId) {
    return err(409, { code: "jobs-workflows.WORKFLOW_RUN_NOT_WAITING", message: "Workflow run has no current step." }, meta);
  }

  const stepId = parsed.data.stepId ?? run.currentStepId;
  if (stepId !== run.currentStepId) {
    return err(
      409,
      { code: "jobs-workflows.WORKFLOW_STEP_NOT_CURRENT", message: `Workflow step ${stepId} is not the current step.` },
      meta
    );
  }

  const step = findWorkflowStep(run, stepId);
  if (!step) {
    return err(404, { code: "jobs-workflows.WORKFLOW_STEP_NOT_FOUND", message: `No workflow step ${stepId} in the run snapshot.` }, meta);
  }

  const stepRun = await deps.stepRunStore.getForOwnerRunStep(run.ownerId, run.id, stepId);
  if (!stepRun) {
    return err(404, { code: "jobs-workflows.WORKFLOW_STEP_RUN_NOT_FOUND", message: `No step run for workflow step ${stepId}.` }, meta);
  }

  if (run.status !== "waiting" || stepRun.status !== "waiting") {
    return err(
      409,
      { code: "jobs-workflows.WORKFLOW_STEP_NOT_WAITING", message: `Workflow step ${stepId} is ${stepRun.status}, not waiting.` },
      meta
    );
  }

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  stepRun.output = parsed.data.output;
  stepRun.error = parsed.data.status === "failed" ? parsed.data.error ?? "Workflow step failed." : null;
  stepRun.finishedAt = nowIso;
  stepRun.updatedAt = nowIso;
  run.context = { ...run.context, ...parsed.data.contextPatch };

  if (parsed.data.status === "failed") {
    stepRun.status = "failed";
    const nextStepId = resolveNextStepId(step, parsed.data.nextStepId, "failed");
    if (!nextStepId) {
      run.status = "failed";
      run.currentStepId = null;
      run.updatedAt = nowIso;
      run.finishedAt = nowIso;
      await deps.stepRunStore.update(stepRun);
      await deps.runStore.update(run);
      return ok(200, {
        run,
        stepRun,
        status: "failed" as const,
        error: stepRun.error ?? "Workflow step failed.",
        event: workflowEvent("workflow.failed", meta.correlationId, run, stepRun)
      }, meta);
    }

    const nextStep = findWorkflowStep(run, nextStepId);
    if (!nextStep) {
      run.status = "failed";
      run.currentStepId = null;
      run.updatedAt = nowIso;
      run.finishedAt = nowIso;
      await deps.stepRunStore.update(stepRun);
      await deps.runStore.update(run);
      return err(
        500,
        { code: "jobs-workflows.WORKFLOW_STEP_NOT_FOUND", message: `Workflow failure target ${nextStepId} is not in the run snapshot.` },
        meta
      );
    }

    run.status = "running";
    run.currentStepId = nextStep.id;
    run.updatedAt = nowIso;
    await deps.stepRunStore.update(stepRun);
    await deps.runStore.update(run);
    const nextStepRun = await deps.stepRunStore.getForOwnerRunStep(run.ownerId, run.id, nextStep.id);
    if (nextStepRun) {
      return ok(200, { run, stepRun, nextStepRun, event: workflowEvent("workflow.step.failed", meta.correlationId, run, stepRun) }, meta);
    }
    const created = createPendingWorkflowStepRun(run, nextStep, nowIso);
    await deps.stepRunStore.insert(created);
    return ok(200, { run, stepRun, nextStepRun: created, event: workflowEvent("workflow.step.failed", meta.correlationId, run, stepRun) }, meta);
  }

  stepRun.status = "succeeded";
  const nextStepId = resolveNextStepId(step, parsed.data.nextStepId, "succeeded");
  if (!nextStepId) {
    run.status = "succeeded";
    run.currentStepId = null;
    run.updatedAt = nowIso;
    run.finishedAt = nowIso;
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
    run.updatedAt = nowIso;
    run.finishedAt = nowIso;
    await deps.stepRunStore.update(stepRun);
    await deps.runStore.update(run);
    return err(500, { code: "jobs-workflows.WORKFLOW_STEP_NOT_FOUND", message: stepRun.error }, meta);
  }

  run.status = "running";
  run.currentStepId = nextStep.id;
  run.updatedAt = nowIso;
  await deps.stepRunStore.update(stepRun);
  await deps.runStore.update(run);
  const nextStepRun = await deps.stepRunStore.getForOwnerRunStep(run.ownerId, run.id, nextStep.id);
  if (nextStepRun) {
    return ok(200, { run, stepRun, nextStepRun, event: workflowEvent("workflow.step.succeeded", meta.correlationId, run, stepRun) }, meta);
  }
  const created = createPendingWorkflowStepRun(run, nextStep, nowIso);
  await deps.stepRunStore.insert(created);
  return ok(200, { run, stepRun, nextStepRun: created, event: workflowEvent("workflow.step.succeeded", meta.correlationId, run, stepRun) }, meta);
}

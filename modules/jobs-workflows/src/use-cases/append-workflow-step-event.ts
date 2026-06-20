import { err, ok } from "@microservices-sh/connection-contract";
import { jobsWorkflowsMeta } from "../meta";
import type { WorkflowStepEventStore } from "../ports";
import { appendWorkflowStepEventInputSchema } from "../schemas";
import type { DomainEvent, WorkflowStepEvent } from "../types";

export async function appendWorkflowStepEvent(
  input: unknown,
  deps: {
    eventStore: WorkflowStepEventStore;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = jobsWorkflowsMeta(deps);
  const parsed = appendWorkflowStepEventInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "jobs-workflows.INVALID_WORKFLOW_STEP_EVENT", message: "Workflow step event input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const stepEvent: WorkflowStepEvent = {
    id: "wfse_" + crypto.randomUUID().slice(0, 16),
    ownerId: parsed.data.ownerId,
    workflowRunId: parsed.data.workflowRunId,
    stepRunId: parsed.data.stepRunId ?? null,
    stepId: parsed.data.stepId ?? null,
    name: parsed.data.name,
    payload: parsed.data.payload,
    createdAt: new Date(deps.now?.() ?? Date.now()).toISOString()
  };

  await deps.eventStore.append(stepEvent);

  const event: DomainEvent = {
    name: "workflow.step.event_recorded",
    correlationId: meta.correlationId,
    payload: {
      id: stepEvent.id,
      ownerId: stepEvent.ownerId,
      workflowRunId: stepEvent.workflowRunId,
      stepRunId: stepEvent.stepRunId,
      stepId: stepEvent.stepId,
      name: stepEvent.name
    }
  };

  return ok(201, { stepEvent, event }, meta);
}

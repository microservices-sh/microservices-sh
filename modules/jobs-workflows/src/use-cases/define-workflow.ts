import { ok, err } from "@microservices-sh/connection-contract";
import { jobsWorkflowsMeta } from "../meta";
import type { WorkflowDefinitionStore } from "../ports";
import { defineWorkflowInputSchema } from "../schemas";
import type { DomainEvent, WorkflowDefinition } from "../types";

export async function defineWorkflow(
  input: unknown,
  deps: {
    definitionStore: WorkflowDefinitionStore;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = jobsWorkflowsMeta(deps);
  const parsed = defineWorkflowInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      {
        code: "jobs-workflows.INVALID_WORKFLOW_DEFINITION",
        message: "Workflow definition input is invalid.",
        issues: parsed.error.issues
      },
      meta
    );
  }

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const definition: WorkflowDefinition = {
    id: parsed.data.id ?? "wf_" + crypto.randomUUID().slice(0, 16),
    ownerId: parsed.data.ownerId,
    name: parsed.data.name,
    version: parsed.data.version,
    status: parsed.data.status,
    trigger: parsed.data.trigger,
    steps: parsed.data.steps,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  await deps.definitionStore.insert(definition);

  const event: DomainEvent = {
    name: "workflow.defined",
    correlationId: meta.correlationId,
    payload: {
      id: definition.id,
      ownerId: definition.ownerId,
      name: definition.name,
      version: definition.version,
      status: definition.status
    }
  };

  return ok(201, { definition, event }, meta);
}

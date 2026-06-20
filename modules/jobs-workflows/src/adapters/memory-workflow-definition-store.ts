import type { WorkflowDefinitionStore } from "../ports";
import type { WorkflowDefinition } from "../types";

function cloneDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  return {
    ...definition,
    trigger: definition.trigger ? { ...definition.trigger } : null,
    steps: definition.steps.map((step) => ({ ...step, input: { ...step.input } }))
  };
}

export function createMemoryWorkflowDefinitionStore(): WorkflowDefinitionStore {
  const definitions = new Map<string, WorkflowDefinition>();

  return {
    async insert(definition) {
      definitions.set(definition.id, cloneDefinition(definition));
    },

    async get(id) {
      const definition = definitions.get(id);
      return definition ? cloneDefinition(definition) : null;
    }
  };
}

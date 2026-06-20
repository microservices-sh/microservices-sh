import type { AgentRun, AgentRunStatus, DomainEvent } from "../types";

const terminalStatuses = new Set<AgentRunStatus>(["succeeded", "failed", "canceled", "timed_out"]);

export function isTerminalAgentRunStatus(status: AgentRunStatus): boolean {
  return terminalStatuses.has(status);
}

export function agentRunCompletionEventName(status: AgentRunStatus): DomainEvent["name"] {
  switch (status) {
    case "succeeded":
      return "agent_dispatch.succeeded";
    case "canceled":
      return "agent_dispatch.canceled";
    case "waiting":
      return "agent_dispatch.waiting";
    default:
      return "agent_dispatch.failed";
  }
}

export function agentRunEventPayload(agentRun: AgentRun): Record<string, unknown> {
  return {
    id: agentRun.id,
    ownerId: agentRun.ownerId,
    workflowRunId: agentRun.workflowRunId,
    stepRunId: agentRun.stepRunId
  };
}

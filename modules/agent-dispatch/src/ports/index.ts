import type { AgentRun, CapabilityGrant } from "../types";

export interface AgentRunStore {
  insert(run: AgentRun): Promise<void>;
  getForOwner(ownerId: string, id: string): Promise<AgentRun | null>;
  update(run: AgentRun): Promise<void>;
  listForWorkflow(ownerId: string, workflowRunId: string): Promise<AgentRun[]>;
}

export interface CapabilityGrantStore {
  insert(grant: CapabilityGrant): Promise<void>;
  getForAgentRun(ownerId: string, agentRunId: string): Promise<CapabilityGrant | null>;
  revoke(ownerId: string, id: string, revokedAt: string): Promise<void>;
}

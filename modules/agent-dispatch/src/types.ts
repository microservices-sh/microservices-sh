export type AgentRuntimeKind =
  | "tool-only"
  | "hermes-fly"
  | "fly-machine"
  | "vercel-sandbox"
  | "research-runtime"
  | "custom";

export type AgentRunStatus =
  | "queued"
  | "provisioning"
  | "running"
  | "waiting"
  | "succeeded"
  | "failed"
  | "canceled"
  | "timed_out";

export interface CapabilityGrant {
  id: string;
  ownerId: string;
  workflowRunId: string;
  stepRunId: string;
  agentRunId: string;
  allowedTools: string[];
  allowedResources: string[];
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface AgentRun {
  id: string;
  ownerId: string;
  workflowRunId: string;
  stepRunId: string;
  agentTemplateId: string;
  runtimeKind: AgentRuntimeKind;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  externalRunId: string | null;
  capabilityGrantId: string;
  resumeTokenHash: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  expiresAt: string;
}

export interface AgentRuntimeStartInput {
  agentRun: AgentRun;
  capabilityGrant: CapabilityGrant;
  resumeToken: string;
}

export interface AgentRuntimeStartResult {
  status?: Extract<AgentRunStatus, "provisioning" | "running" | "waiting" | "succeeded" | "failed">;
  externalRunId?: string;
  output?: Record<string, unknown>;
  error?: string;
}

export interface AgentRuntimeCancelInput {
  agentRun: AgentRun;
}

export interface AgentRuntime {
  start(input: AgentRuntimeStartInput): Promise<void | AgentRuntimeStartResult>;
  cancel?(input: AgentRuntimeCancelInput): Promise<void>;
}

export type AgentDispatchEventName =
  | "agent_dispatch.dispatched"
  | "agent_dispatch.waiting"
  | "agent_dispatch.succeeded"
  | "agent_dispatch.failed"
  | "agent_dispatch.canceled";

export interface DomainEvent {
  name: AgentDispatchEventName;
  correlationId: string;
  payload: Record<string, unknown>;
}

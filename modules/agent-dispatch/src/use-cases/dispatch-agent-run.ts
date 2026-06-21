import { err, ok } from "@microservices-sh/connection-contract";
import { agentDispatchMeta } from "../meta";
import type { AgentRunStore, CapabilityGrantStore } from "../ports";
import { dispatchAgentRunInputSchema } from "../schemas";
import { createResumeToken, hashResumeToken } from "../token";
import type { AgentRun, AgentRuntime, CapabilityGrant, DomainEvent } from "../types";
import { agentRunEventPayload, isTerminalAgentRunStatus } from "./agent-run-helpers";

export async function dispatchAgentRun(
  input: unknown,
  runtime: AgentRuntime,
  deps: {
    agentRunStore: AgentRunStore;
    capabilityGrantStore: CapabilityGrantStore;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = agentDispatchMeta(deps);
  const parsed = dispatchAgentRunInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "agent-dispatch.INVALID_DISPATCH_INPUT", message: "Agent dispatch input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const data = parsed.data;
  const nowMs = deps.now?.() ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + data.ttlMs).toISOString();
  const resumeToken = createResumeToken();
  const resumeTokenHash = await hashResumeToken(resumeToken);
  const agentRunId = "agr_" + crypto.randomUUID().slice(0, 16);
  const capabilityGrantId = "cap_" + crypto.randomUUID().slice(0, 16);

  const grant: CapabilityGrant = {
    id: capabilityGrantId,
    ownerId: data.ownerId,
    workflowRunId: data.workflowRunId,
    stepRunId: data.stepRunId,
    agentRunId,
    allowedTools: data.allowedTools,
    allowedResources: data.allowedResources,
    expiresAt,
    createdAt: nowIso,
    revokedAt: null
  };

  const agentRun: AgentRun = {
    id: agentRunId,
    ownerId: data.ownerId,
    workflowRunId: data.workflowRunId,
    stepRunId: data.stepRunId,
    agentTemplateId: data.agentTemplateId,
    runtimeKind: data.runtimeKind,
    status: "queued",
    input: data.input,
    output: null,
    error: null,
    externalRunId: null,
    capabilityGrantId,
    resumeTokenHash,
    createdAt: nowIso,
    updatedAt: nowIso,
    finishedAt: null,
    expiresAt
  };

  await deps.capabilityGrantStore.insert(grant);
  await deps.agentRunStore.insert(agentRun);

  try {
    const result = await runtime.start({ agentRun, capabilityGrant: grant, resumeToken });
    const updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
    agentRun.status = result?.status ?? "running";
    agentRun.externalRunId = result?.externalRunId ?? null;
    agentRun.output = result?.output ?? null;
    agentRun.error = result?.error ?? null;
    agentRun.updatedAt = updatedAt;
    if (isTerminalAgentRunStatus(agentRun.status)) {
      agentRun.finishedAt = updatedAt;
    }
    await deps.agentRunStore.update(agentRun);
  } catch (e) {
    const updatedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
    agentRun.status = "failed";
    agentRun.error = e instanceof Error ? e.message : String(e);
    agentRun.updatedAt = updatedAt;
    agentRun.finishedAt = updatedAt;
    await deps.agentRunStore.update(agentRun);
  }

  if (agentRun.finishedAt && isTerminalAgentRunStatus(agentRun.status)) {
    await deps.capabilityGrantStore.revoke(agentRun.ownerId, grant.id, agentRun.finishedAt);
    grant.revokedAt = agentRun.finishedAt;
  }

  const eventName: DomainEvent["name"] = agentRun.status === "failed" ? "agent_dispatch.failed" : "agent_dispatch.dispatched";
  const event: DomainEvent = {
    name: eventName,
    correlationId: meta.correlationId,
    payload: {
      ...agentRunEventPayload(agentRun),
      runtimeKind: agentRun.runtimeKind,
      status: agentRun.status
    }
  };

  return ok(201, { agentRun, capabilityGrant: grant, resumeToken, event }, meta);
}

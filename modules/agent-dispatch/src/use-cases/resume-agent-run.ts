import { err, ok } from "@microservices-sh/connection-contract";
import { agentDispatchMeta } from "../meta";
import type { AgentRunStore, CapabilityGrantStore } from "../ports";
import { resumeAgentRunInputSchema } from "../schemas";
import { hashResumeToken } from "../token";
import type { DomainEvent } from "../types";
import { agentRunCompletionEventName, agentRunEventPayload, isTerminalAgentRunStatus } from "./agent-run-helpers";

export async function resumeAgentRun(
  input: unknown,
  deps: {
    agentRunStore: AgentRunStore;
    capabilityGrantStore: CapabilityGrantStore;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = agentDispatchMeta(deps);
  const parsed = resumeAgentRunInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "agent-dispatch.INVALID_RESUME_INPUT", message: "Agent resume input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const data = parsed.data;
  const agentRun = await deps.agentRunStore.getForOwner(data.ownerId, data.agentRunId);
  if (!agentRun) {
    return err(404, { code: "agent-dispatch.AGENT_RUN_NOT_FOUND", message: `No agent run ${data.agentRunId}.` }, meta);
  }

  if (isTerminalAgentRunStatus(agentRun.status)) {
    return ok(200, { agentRun, skipped: true }, meta);
  }

  const grant = await deps.capabilityGrantStore.getForAgentRun(agentRun.ownerId, agentRun.id);
  if (!grant || grant.revokedAt) {
    return err(403, { code: "agent-dispatch.CAPABILITY_GRANT_REVOKED", message: "Capability grant is missing or revoked." }, meta);
  }

  const nowMs = deps.now?.() ?? Date.now();
  if (Date.parse(grant.expiresAt) <= nowMs || Date.parse(agentRun.expiresAt) <= nowMs) {
    return err(403, { code: "agent-dispatch.CAPABILITY_GRANT_EXPIRED", message: "Capability grant has expired." }, meta);
  }

  const tokenHash = await hashResumeToken(data.resumeToken);
  if (tokenHash !== agentRun.resumeTokenHash) {
    return err(403, { code: "agent-dispatch.INVALID_RESUME_TOKEN", message: "Resume token is invalid." }, meta);
  }

  const finishedAt = new Date(nowMs).toISOString();
  agentRun.status = data.status;
  agentRun.output = data.output;
  agentRun.error = data.status === "failed" ? data.error ?? "Agent run failed." : data.error ?? null;
  agentRun.updatedAt = finishedAt;
  agentRun.finishedAt = finishedAt;
  await deps.agentRunStore.update(agentRun);
  await deps.capabilityGrantStore.revoke(agentRun.ownerId, grant.id, finishedAt);

  const event: DomainEvent = {
    name: agentRunCompletionEventName(agentRun.status),
    correlationId: meta.correlationId,
    payload: {
      ...agentRunEventPayload(agentRun),
      status: agentRun.status
    }
  };

  const workflowResume = {
    ownerId: agentRun.ownerId,
    workflowRunId: agentRun.workflowRunId,
    status: data.status === "succeeded" ? ("succeeded" as const) : ("failed" as const),
    output: data.output,
    error: agentRun.error ?? undefined,
    contextPatch: {
      agentRunId: agentRun.id,
      agentStatus: agentRun.status,
      ...data.contextPatch
    }
  };

  return ok(200, { agentRun, grant: { ...grant, revokedAt: finishedAt }, workflowResume, event }, meta);
}

import { err, ok } from "@microservices-sh/connection-contract";
import { agentDispatchMeta } from "../meta";
import type { AgentRunStore, CapabilityGrantStore } from "../ports";
import { cancelAgentRunInputSchema } from "../schemas";
import type { AgentRuntime, DomainEvent } from "../types";
import { agentRunEventPayload, isTerminalAgentRunStatus } from "./agent-run-helpers";

export async function cancelAgentRun(
  input: unknown,
  deps: {
    agentRunStore: AgentRunStore;
    capabilityGrantStore: CapabilityGrantStore;
    runtime?: AgentRuntime;
    now?: () => number;
    correlationId?: string;
  }
) {
  const meta = agentDispatchMeta(deps);
  const parsed = cancelAgentRunInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "agent-dispatch.INVALID_CANCEL_INPUT", message: "Agent cancel input is invalid.", issues: parsed.error.issues },
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

  if (deps.runtime?.cancel) {
    await deps.runtime.cancel({ agentRun });
  }

  const finishedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  agentRun.status = "canceled";
  agentRun.updatedAt = finishedAt;
  agentRun.finishedAt = finishedAt;
  await deps.agentRunStore.update(agentRun);

  const grant = await deps.capabilityGrantStore.getForAgentRun(agentRun.ownerId, agentRun.id);
  if (grant) {
    await deps.capabilityGrantStore.revoke(agentRun.ownerId, grant.id, finishedAt);
  }

  const event: DomainEvent = {
    name: "agent_dispatch.canceled",
    correlationId: meta.correlationId,
    payload: agentRunEventPayload(agentRun)
  };

  return ok(200, { agentRun, event }, meta);
}

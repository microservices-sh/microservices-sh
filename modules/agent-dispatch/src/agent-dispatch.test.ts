import { describe, expect, it } from "vitest";
import {
  cancelAgentRun,
  createMemoryAgentRunStore,
  createMemoryCapabilityGrantStore,
  dispatchAgentRun,
  resumeAgentRun
} from "./index";
import type { AgentRuntime } from "./types";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

function stores() {
  return {
    agentRunStore: createMemoryAgentRunStore(),
    capabilityGrantStore: createMemoryCapabilityGrantStore()
  };
}

describe("agent-dispatch", () => {
  it("dispatches an agent run with a one-time resume token and capability grant", async () => {
    const deps = stores();
    let capturedToken = "";
    const runtime: AgentRuntime = {
      async start({ resumeToken, capabilityGrant }) {
        capturedToken = resumeToken;
        expect(capabilityGrant.allowedTools).toEqual(["research.read"]);
        return { status: "running", externalRunId: "runtime_1" };
      }
    };

    const dispatched = await dispatchAgentRun(
      {
        ownerId: "org_1",
        workflowRunId: "wfr_1",
        stepRunId: "wfsr_1",
        agentTemplateId: "researcher",
        runtimeKind: "custom",
        input: { topic: "permissions" },
        allowedTools: ["research.read"]
      },
      runtime,
      { ...deps, now: fixedNow(T0), correlationId: "corr_1" }
    );

    expect(dispatched.ok).toBe(true);
    if (!dispatched.ok) throw new Error("expected ok");
    expect(dispatched.data.resumeToken).toBe(capturedToken);
    expect(dispatched.data.agentRun.status).toBe("running");
    expect(dispatched.data.agentRun.externalRunId).toBe("runtime_1");
    expect(dispatched.data.agentRun.resumeTokenHash).not.toBe(dispatched.data.resumeToken);
    expect(dispatched.data.event.correlationId).toBe("corr_1");
  });

  it("revokes the capability grant when dispatch finishes immediately", async () => {
    const deps = stores();
    const dispatched = await dispatchAgentRun(
      {
        ownerId: "org_1",
        workflowRunId: "wfr_1",
        stepRunId: "wfsr_1",
        agentTemplateId: "researcher",
        runtimeKind: "custom"
      },
      { async start() { return { status: "succeeded", output: { ok: true } }; } },
      { ...deps, now: fixedNow(T0) }
    );

    expect(dispatched.ok).toBe(true);
    if (!dispatched.ok) throw new Error("expected ok");
    expect(dispatched.data.agentRun.status).toBe("succeeded");
    expect(dispatched.data.capabilityGrant.revokedAt).toBe(new Date(T0).toISOString());

    const grant = await deps.capabilityGrantStore.getForAgentRun("org_1", dispatched.data.agentRun.id);
    expect(grant?.revokedAt).toBe(new Date(T0).toISOString());
  });

  it("revokes the capability grant when runtime start throws", async () => {
    const deps = stores();
    const dispatched = await dispatchAgentRun(
      {
        ownerId: "org_1",
        workflowRunId: "wfr_1",
        stepRunId: "wfsr_1",
        agentTemplateId: "researcher",
        runtimeKind: "custom"
      },
      { async start() { throw new Error("runtime failed"); } },
      { ...deps, now: fixedNow(T0) }
    );

    expect(dispatched.ok).toBe(true);
    if (!dispatched.ok) throw new Error("expected ok");
    expect(dispatched.data.agentRun.status).toBe("failed");
    expect(dispatched.data.capabilityGrant.revokedAt).toBe(new Date(T0).toISOString());
  });

  it("resumes an agent run and returns a workflow resume payload", async () => {
    const deps = stores();
    const dispatched = await dispatchAgentRun(
      {
        ownerId: "org_1",
        workflowRunId: "wfr_1",
        stepRunId: "wfsr_1",
        agentTemplateId: "researcher",
        runtimeKind: "custom"
      },
      { async start() { return { status: "waiting" }; } },
      { ...deps, now: fixedNow(T0) }
    );
    if (!dispatched.ok) throw new Error("expected ok");

    const resumed = await resumeAgentRun(
      {
        ownerId: "org_1",
        agentRunId: dispatched.data.agentRun.id,
        resumeToken: dispatched.data.resumeToken,
        status: "succeeded",
        output: { reportId: "report_1" },
        contextPatch: { reportId: "report_1" }
      },
      { ...deps, now: fixedNow(T0 + 1) }
    );

    expect(resumed.ok).toBe(true);
    if (!resumed.ok) throw new Error("expected ok");
    expect(resumed.data.agentRun.status).toBe("succeeded");
    const resumedData = resumed.data as unknown as {
      workflowResume: Record<string, unknown>;
      grant: { revokedAt: string | null };
    };
    expect(resumedData.workflowResume).toEqual({
      ownerId: "org_1",
      workflowRunId: "wfr_1",
      status: "succeeded",
      output: { reportId: "report_1" },
      error: undefined,
      contextPatch: {
        agentRunId: dispatched.data.agentRun.id,
        agentStatus: "succeeded",
        reportId: "report_1"
      }
    });
    expect(resumedData.grant.revokedAt).toBe(new Date(T0 + 1).toISOString());
  });

  it("rejects wrong owner and wrong resume token", async () => {
    const deps = stores();
    const dispatched = await dispatchAgentRun(
      {
        ownerId: "org_1",
        workflowRunId: "wfr_1",
        stepRunId: "wfsr_1",
        agentTemplateId: "researcher",
        runtimeKind: "custom"
      },
      { async start() { return { status: "running" }; } },
      { ...deps, now: fixedNow(T0) }
    );
    if (!dispatched.ok) throw new Error("expected ok");

    const wrongOwner = await resumeAgentRun(
      {
        ownerId: "org_2",
        agentRunId: dispatched.data.agentRun.id,
        resumeToken: dispatched.data.resumeToken,
        status: "succeeded"
      },
      { ...deps, now: fixedNow(T0 + 1) }
    );
    expect(wrongOwner.ok).toBe(false);
    if (!wrongOwner.ok) expect(wrongOwner.error.code).toBe("agent-dispatch.AGENT_RUN_NOT_FOUND");

    const wrongToken = await resumeAgentRun(
      {
        ownerId: "org_1",
        agentRunId: dispatched.data.agentRun.id,
        resumeToken: "0".repeat(64),
        status: "succeeded"
      },
      { ...deps, now: fixedNow(T0 + 1) }
    );
    expect(wrongToken.ok).toBe(false);
    if (!wrongToken.ok) expect(wrongToken.error.code).toBe("agent-dispatch.INVALID_RESUME_TOKEN");
  });

  it("rejects expired capability grants", async () => {
    const deps = stores();
    const dispatched = await dispatchAgentRun(
      {
        ownerId: "org_1",
        workflowRunId: "wfr_1",
        stepRunId: "wfsr_1",
        agentTemplateId: "researcher",
        runtimeKind: "custom",
        ttlMs: 1000
      },
      { async start() { return { status: "running" }; } },
      { ...deps, now: fixedNow(T0) }
    );
    if (!dispatched.ok) throw new Error("expected ok");

    const expired = await resumeAgentRun(
      {
        ownerId: "org_1",
        agentRunId: dispatched.data.agentRun.id,
        resumeToken: dispatched.data.resumeToken,
        status: "succeeded"
      },
      { ...deps, now: fixedNow(T0 + 1000) }
    );
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.error.code).toBe("agent-dispatch.CAPABILITY_GRANT_EXPIRED");
  });

  it("cancels a running agent and revokes its grant", async () => {
    const deps = stores();
    let canceled = false;
    const runtime: AgentRuntime = {
      async start() {
        return { status: "running" };
      },
      async cancel() {
        canceled = true;
      }
    };
    const dispatched = await dispatchAgentRun(
      {
        ownerId: "org_1",
        workflowRunId: "wfr_1",
        stepRunId: "wfsr_1",
        agentTemplateId: "researcher",
        runtimeKind: "custom"
      },
      runtime,
      { ...deps, now: fixedNow(T0) }
    );
    if (!dispatched.ok) throw new Error("expected ok");

    const canceledRun = await cancelAgentRun(
      { ownerId: "org_1", agentRunId: dispatched.data.agentRun.id },
      { ...deps, runtime, now: fixedNow(T0 + 1) }
    );
    expect(canceledRun.ok).toBe(true);
    if (!canceledRun.ok) throw new Error("expected ok");
    expect(canceledRun.data.agentRun.status).toBe("canceled");
    expect(canceled).toBe(true);

    const resumed = await resumeAgentRun(
      {
        ownerId: "org_1",
        agentRunId: dispatched.data.agentRun.id,
        resumeToken: dispatched.data.resumeToken,
        status: "succeeded"
      },
      { ...deps, now: fixedNow(T0 + 2) }
    );
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) throw new Error("expected ok");
    expect((resumed.data as { skipped?: boolean }).skipped).toBe(true);
  });
});

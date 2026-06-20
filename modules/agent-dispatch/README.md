# Agent Dispatch Module

Status: `draft` (v0.1.0) · Class: `platform` · Risk: `high`

Runtime-neutral dispatch bridge between `jobs-workflows` and isolated agent
executors. It does not own workflow state. It creates an `agent_run`, mints a
short-lived capability grant, hands a one-time resume token to the runtime, and
turns runtime callbacks into a `workflowResume` payload that the host app can
pass to `resumeWorkflowStep`.

This is the revamp boundary:

```text
jobs-workflows -> agent-dispatch -> isolated runtime
                               -> resumeAgentRun -> resumeWorkflowStep
```

Hermes, Fly Machines, Vercel Sandbox, Cloudflare Sandbox, research runtime, and
tool-only executors should all implement the `AgentRuntime` interface rather
than writing workflow state directly.

## Public Surface

```ts
import {
  dispatchAgentRun,
  resumeAgentRun,
  cancelAgentRun,
  createD1AgentRunStore,
  createD1CapabilityGrantStore
} from "@microservices-sh/agent-dispatch";
```

- `dispatchAgentRun(input, runtime, deps)` - create an agent run, capability
  grant, one-time resume token, then start the runtime.
- `resumeAgentRun(input, deps)` - verify owner scope and resume token, mark the
  agent run terminal, revoke the grant, and return a workflow resume payload.
- `cancelAgentRun(input, deps)` - cancel a non-terminal run and revoke its grant.

## Runtime Contract

```ts
const runtime = {
  async start({ agentRun, capabilityGrant, resumeToken }) {
    await startIsolatedExecutor({ agentRun, capabilityGrant, resumeToken });
    return { status: "running", externalRunId: "fly-machine-id" };
  },
  async cancel({ agentRun }) {
    await stopExecutor(agentRun.externalRunId);
  }
};
```

The raw `resumeToken` is returned only once and stored only as a hash. Runtime
callbacks must call `resumeAgentRun` with `ownerId`, `agentRunId`, and that
token. The returned `workflowResume` object is intentionally compatible with the
`jobs-workflows` resume use case.

## Resources

- D1 (`DB`): `agent_runs`, `capability_grants`.

## Verification

```bash
pnpm --filter @microservices-sh/agent-dispatch build
pnpm --filter @microservices-sh/agent-dispatch test
pnpm --filter @microservices-sh/agent-dispatch check:spec
```

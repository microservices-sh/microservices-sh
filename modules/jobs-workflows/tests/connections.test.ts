import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";
import { enqueueJob } from "../src/use-cases/enqueue-job";
import { createMemoryJobStore } from "../src/adapters/memory-job-store";

const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

describe("jobs-workflows connections manifest", () => {
  it("composes standalone (no requires, no rpc.calls, consumes nothing)", () => {
    const r = compose([
      { id: "jobs-workflows", grantedScopes: ["jobs-workflows.extend"], connections: manifest.connections }
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wiring.modules).toContain("jobs-workflows");
      expect(r.warnings).toEqual([]);
    }
  });

  it("declares typed lifecycle hook points scoped to jobs-workflows.extend", () => {
    expect(manifest.connections.hookPoints.beforeJobEnqueue.kind).toBe("filter");
    expect(manifest.connections.hookPoints.computeBackoffMs.kind).toBe("filter");
    expect(manifest.connections.hookPoints.onJobDead.kind).toBe("observer");
    for (const point of Object.values(manifest.connections.hookPoints) as Array<{ scope: string }>) {
      expect(point.scope).toBe("jobs-workflows.extend");
    }
  });

  it("emits its lifecycle events and consumes none (cron-driven, not event-driven)", () => {
    expect(manifest.connections.events.emits).toContain("job.enqueued");
    expect(manifest.connections.events.emits).toContain("job.dead");
    expect(manifest.connections.events.consumes).toEqual([]);
  });
});

describe("enqueueJob meta + namespaced errors", () => {
  const deps = () => ({ jobStore: createMemoryJobStore() });

  it("threads correlationId through meta and the emitted event", async () => {
    const r = await enqueueJob({ type: "email", payload: { to: "a@b.c" } }, { ...deps(), correlationId: "corr-x" });
    expect(r.ok).toBe(true);
    expect(r.meta.correlationId).toBe("corr-x");
    if (r.ok) expect(r.data.event?.correlationId).toBe("corr-x");
  });

  it("validation errors are namespaced and carry meta", async () => {
    const r = await enqueueJob({ type: "" }, deps());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("jobs-workflows.INVALID_JOB_INPUT");
    expect(r.meta.source).toBe("jobs-workflows");
  });
});

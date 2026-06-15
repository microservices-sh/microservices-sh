import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { signEnvelope } from "@microservices-sh/connection-contract";
import { compose } from "@microservices-sh/connection-contract/composer";
import { handleQueueBatch } from "@microservices-sh/connection-contract/runtime/event-consumer";
import { emitArtifacts } from "../../packages/sdk-internal/src/emit.js";
import { eventRoutes } from "../../packages/sdk-internal/src/event-codegen.js";
import { consumeEvent, createMemoryAuditEventStore } from "../../modules/audit-log/src/index.ts";

// Embedded-topology e2e: drive the REAL composer → emitArtifacts → generated
// event routes → runtime queue consumer, end to end, from the real module
// manifests. (The workerd/pool-workers service-topology harness with D1 +
// service bindings is still deferred — high-risk infra with no in-repo
// worker-boot precedent; tracked in the Phase 3 plan Task 7.)

function mod(id: string, grantedScopes: string[] = []) {
  const manifest = JSON.parse(
    readFileSync(new URL(`../../modules/${id}/module.json`, import.meta.url), "utf8")
  );
  return { id, grantedScopes, connections: manifest.connections };
}

const fixture = () => [
  mod("auth"),
  mod("customer"),
  mod("payment", ["auth.verify"]),
  mod("booking", ["customer.read"]),
  mod("audit-log"),
];

describe("honeycomb pipeline (embedded, composer→runtime)", () => {
  it("composes the 5-module fixture from real manifests with no errors", () => {
    const r = compose(fixture());
    expect(r.ok).toBe(true);
  });

  it("generated event routes fan lifecycle events to their consumers", () => {
    const r = compose(fixture());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const routes = eventRoutes(r.wiring);
    expect(routes["payment.succeeded"]).toContain("audit-log");
    expect(routes["payment.succeeded"]).toContain("booking");
    expect(routes["booking.created"]).toContain("audit-log");
  });

  it("scenario 3+5: a signed event fans out to consumers and correlationId survives the queue hop", async () => {
    const r = compose(fixture());
    if (!r.ok) throw new Error("compose failed");
    const routes = eventRoutes(r.wiring);
    const auditStore = createMemoryAuditEventStore();
    const CID = "corr-e2e-1";

    const signed = await signEnvelope(
      { eventName: "payment.succeeded", entityType: "payment", entityId: "p1", source: "payment", correlationId: CID, payload: { amount: 100 } },
      "tenant-secret"
    );

    const seen: Array<[string, string | null | undefined]> = [];
    const res = await handleQueueBatch([{ body: signed }], {
      routes,
      secret: "tenant-secret",
      dispatch: async (module, env) => {
        seen.push([module, env.correlationId]);
        if (module === "audit-log") await consumeEvent(env, { auditStore });
      },
    });

    expect(res).toEqual({ acked: 1, rejected: 0 });
    expect(seen).toContainEqual(["audit-log", CID]);
    expect(seen).toContainEqual(["booking", CID]);
    // audit-log actually recorded the event
    const recorded = await auditStore.list({ limit: 10 });
    expect(recorded.some((e: any) => e.eventName === "payment.succeeded")).toBe(true);
  });

  it("scenario 3 (neg): a tampered envelope is rejected with no dispatch", async () => {
    const r = compose(fixture());
    if (!r.ok) throw new Error("compose failed");
    const routes = eventRoutes(r.wiring);
    const signed = await signEnvelope(
      { eventName: "payment.succeeded", entityType: "payment", entityId: "p1", source: "payment", correlationId: "c", payload: { amount: 1 } },
      "tenant-secret"
    );
    let dispatched = false;
    const res = await handleQueueBatch([{ body: { ...signed, payload: { amount: 999 } } }], {
      routes,
      secret: "tenant-secret",
      dispatch: async () => { dispatched = true; },
    });
    expect(res).toEqual({ acked: 0, rejected: 1 });
    expect(dispatched).toBe(false);
  });

  it("scenario 7: raw modules → compose → emitArtifacts yields consistent wiring + generated files", () => {
    const r = compose(fixture());
    if (!r.ok) throw new Error("compose failed");
    const written: Record<string, string> = {};
    const paths = emitArtifacts({ result: r, modules: fixture(), write: (p, c) => { written[p] = c; } });
    expect(paths).toContain("wiring.json");
    expect(paths).toContain("generated/event-routes.ts");
    expect(paths).toContain("generated/hook-chains.ts");
    expect(JSON.parse(written["wiring.json"]).modules).toContain("audit-log");
  });
});

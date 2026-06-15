import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";
import { createPlan } from "../src/use-cases/create-plan";
import { createMemoryBillingStore } from "../src/adapters/memory-billing-store";

const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

const validPlan = { name: "Pro", priceCents: 2999, currency: "USD", interval: "month" as const };
const deps = () => ({ store: createMemoryBillingStore() });

describe("billing-subscriptions connections manifest", () => {
  it("composes standalone (no requires, no rpc.calls)", () => {
    const r = compose([
      {
        id: "billing-subscriptions",
        grantedScopes: manifest.permissions,
        connections: manifest.connections
      }
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wiring.modules).toContain("billing-subscriptions");
  });

  it("declares typed hook points", () => {
    expect(manifest.connections.hookPoints.beforeSubscriptionChange.kind).toBe("guard");
    expect(manifest.connections.hookPoints.onSubscriptionActivated.kind).toBe("observer");
    expect(manifest.connections.hookPoints.onSubscriptionPastDue.kind).toBe("observer");
  });

  it("exposes its rpc methods and declares no cross-module calls", () => {
    const methods = manifest.connections.rpc.exposes.map((e: { method: string }) => e.method);
    expect(methods).toContain("startSubscription");
    expect(methods).toContain("applyStripeEvent");
    expect(manifest.connections.rpc.calls).toEqual([]);
  });

  it("emits its lifecycle events and consumes none", () => {
    expect(manifest.connections.events.emits).toContain("subscription.started");
    expect(manifest.connections.events.consumes).toEqual([]);
  });
});

describe("createPlan meta + namespaced errors", () => {
  it("threads correlationId through meta", async () => {
    const r = await createPlan(validPlan, { ...deps(), correlationId: "corr-x" });
    expect(r.ok).toBe(true);
    expect(r.meta.correlationId).toBe("corr-x");
    expect(r.meta.source).toBe("billing-subscriptions");
  });

  it("validation errors are namespaced and carry meta", async () => {
    const r = await createPlan({}, deps());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("billing-subscriptions.INVALID_PLAN_INPUT");
    expect(r.meta.source).toBe("billing-subscriptions");
  });
});

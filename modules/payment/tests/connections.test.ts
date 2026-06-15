import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";
import { createPaymentIntent } from "../src/use-cases/create-payment-intent";
import { createMemoryPaymentRepository } from "../src/adapters/memory-payment-repository";
import { createMemoryPaymentGateway } from "../src/adapters/memory-payment-gateway";

const paymentManifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
const authManifest = JSON.parse(readFileSync(new URL("../../auth/module.json", import.meta.url), "utf8"));

// customer is migrated in phase 3; synthesize the minimal slice payment depends on.
const customerConnections = {
  rpc: { exposes: [{ method: "getCustomer", scope: "customer.read", public: false }] },
};

const validInput = { customerId: "c1", amount: 100, currency: "usd" };
const deps = () => ({
  paymentRepository: createMemoryPaymentRepository(),
  paymentGateway: createMemoryPaymentGateway(),
});

describe("payment connections manifest", () => {
  it("composes with auth + customer (resolving rpc.call + scope)", () => {
    const r = compose([
      { id: "auth", grantedScopes: [], connections: authManifest.connections },
      { id: "customer", grantedScopes: [], connections: customerConnections },
      { id: "payment", grantedScopes: ["auth.verify"], connections: paymentManifest.connections },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wiring.rpc).toContainEqual(
        expect.objectContaining({ from: "payment", target: "auth.verifyToken" })
      );
    }
  });

  it("fails to compose when payment lacks the auth.verify scope (SCOPE_GAP)", () => {
    const r = compose([
      { id: "auth", grantedScopes: [], connections: authManifest.connections },
      { id: "customer", grantedScopes: [], connections: customerConnections },
      { id: "payment", grantedScopes: [], connections: paymentManifest.connections },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.code === "SCOPE_GAP")).toBe(true);
  });

  it("declares typed hook points", () => {
    expect(paymentManifest.connections.hookPoints.beforeCreatePaymentIntent.kind).toBe("filter");
    expect(paymentManifest.connections.hookPoints.afterPaymentSucceeded.kind).toBe("observer");
  });
});

describe("createPaymentIntent cross-module hooks + meta", () => {
  it("a filter hook mutates the input before the gateway call", async () => {
    const filter = { kind: "filter" as const, order: 10, fn: async (i: any) => ({ ...i, amount: i.amount + 5 }) };
    const r = await createPaymentIntent(validInput, { ...deps(), correlationId: "corr-x", beforeCreateHooks: [filter] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.payment.amount).toBe(105);
      expect(r.data.event.correlationId).toBe("corr-x");
    }
    expect(r.meta.correlationId).toBe("corr-x");
  });

  it("a guard hook can veto the operation", async () => {
    const guard = {
      kind: "guard" as const,
      order: 10,
      fn: async () => ({ ok: false as const, status: 409, error: { code: "payment.BLOCKED", message: "blocked" } }),
    };
    const r = await createPaymentIntent(validInput, { ...deps(), beforeCreateHooks: [guard] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("payment.BLOCKED");
      expect(r.status).toBe(409);
    }
  });

  it("validation errors are namespaced and carry meta", async () => {
    const r = await createPaymentIntent({}, deps());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("payment.INVALID_PAYMENT_INPUT");
    expect(r.meta.source).toBe("payment");
  });
});

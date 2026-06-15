import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { signEnvelope, verifyEnvelope } from "@microservices-sh/connection-contract";
import { compose } from "@microservices-sh/connection-contract/composer";
import {
  mintToken,
  verifyToken,
  rotateSigningKey,
  requireScope,
  createMemorySigningKeyStore,
} from "@microservices-sh/auth";
import {
  createPaymentIntent,
  createMemoryPaymentRepository,
  createMemoryPaymentGateway,
} from "@microservices-sh/payment";

const authManifest = JSON.parse(readFileSync(new URL("../../modules/auth/module.json", import.meta.url), "utf8"));
const paymentManifest = JSON.parse(readFileSync(new URL("../../modules/payment/module.json", import.meta.url), "utf8"));
const customerConnections = { rpc: { exposes: [{ method: "getCustomer", scope: "customer.read", public: false }] } };

const CID = "corr-integration-1";

async function authStore() {
  const store = createMemorySigningKeyStore();
  await rotateSigningKey({ signingKeyStore: store });
  return store;
}

describe("compose [auth, customer, payment] (embedded)", () => {
  it("resolves the honeycomb with no errors", () => {
    const r = compose([
      { id: "auth", grantedScopes: [], connections: authManifest.connections },
      { id: "customer", grantedScopes: [], connections: customerConnections },
      { id: "payment", grantedScopes: ["auth.verify"], connections: paymentManifest.connections },
    ]);
    expect(r.ok).toBe(true);
  });
});

describe("RPC auth gate (payment verifies caller token via auth)", () => {
  it("accepts a token carrying the required scope", async () => {
    const store = await authStore();
    const minted = await mintToken(
      { subject: "u1", workspace: "w1", project: "p1", scopes: ["payment.write"] },
      { signingKeyStore: store, correlationId: CID }
    );
    expect(minted.ok).toBe(true);
    if (!minted.ok) return;

    const verified = await verifyToken({ token: minted.data.token }, { signingKeyStore: store, correlationId: CID });
    expect(verified.ok).toBe(true);
    expect(verified.meta.correlationId).toBe(CID);
    if (!verified.ok) return;

    expect(requireScope(verified.data.claims, "payment.write").ok).toBe(true);
  });

  it("rejects a token missing the required scope with 403", async () => {
    const store = await authStore();
    const minted = await mintToken(
      { subject: "u2", workspace: "w1", project: "p1", scopes: ["other.read"] },
      { signingKeyStore: store }
    );
    if (!minted.ok) throw new Error("mint failed");
    const verified = await verifyToken({ token: minted.data.token }, { signingKeyStore: store });
    if (!verified.ok) throw new Error("verify failed");

    const scoped = requireScope(verified.data.claims, "payment.write");
    expect(scoped.ok).toBe(false);
    if (!scoped.ok) expect(scoped.status).toBe(403);
  });

  it("rejects an expired token with 401", async () => {
    const store = await authStore();
    const past = () => Date.now() - 10 * 60 * 1000; // minted 10 min ago, ttl 60s
    const minted = await mintToken(
      { subject: "u3", workspace: "w1", project: "p1", scopes: ["payment.write"], ttlSeconds: 60 },
      { signingKeyStore: store, now: past }
    );
    if (!minted.ok) throw new Error("mint failed");
    const verified = await verifyToken({ token: minted.data.token }, { signingKeyStore: store });
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.status).toBe(401);
      expect(verified.error.code).toBe("auth.TOKEN_EXPIRED");
    }
  });
});

describe("payment hook chain + signed event + correlationId thread", () => {
  it("threads one correlationId across verify, payment, hook, and the signed event", async () => {
    const store = await authStore();

    // caller token verified under CID
    const minted = await mintToken(
      { subject: "u1", workspace: "w1", project: "p1", scopes: ["payment.write"] },
      { signingKeyStore: store, correlationId: CID }
    );
    if (!minted.ok) throw new Error("mint failed");
    const verified = await verifyToken({ token: minted.data.token }, { signingKeyStore: store, correlationId: CID });
    expect(verified.meta.correlationId).toBe(CID);

    // cross-module filter mutates input; guard would veto (not added here)
    const filter = { kind: "filter" as const, order: 10, fn: async (i: any) => ({ ...i, amount: i.amount + 1 }) };
    const pi = await createPaymentIntent(
      { customerId: "c1", amount: 100, currency: "usd" },
      {
        paymentRepository: createMemoryPaymentRepository(),
        paymentGateway: createMemoryPaymentGateway(),
        correlationId: CID,
        beforeCreateHooks: [filter],
      }
    );
    expect(pi.ok).toBe(true);
    if (!pi.ok) return;
    expect(pi.data.payment.amount).toBe(101); // filter applied
    expect(pi.meta.correlationId).toBe(CID);
    expect(pi.data.event.correlationId).toBe(CID);

    // emit as a signed envelope; correlationId is inside the signature
    const signed = await signEnvelope(
      {
        eventName: pi.data.event.name,
        entityType: "payment",
        entityId: pi.data.payment.id,
        source: "payment",
        correlationId: pi.data.event.correlationId,
        payload: pi.data.event.payload,
      },
      "tenant-secret"
    );
    expect(await verifyEnvelope(signed, "tenant-secret")).toBe(true);
    expect(await verifyEnvelope({ ...signed, correlationId: "evil" }, "tenant-secret")).toBe(false);
  });
});

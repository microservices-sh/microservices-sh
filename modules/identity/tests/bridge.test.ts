import { describe, it, expect } from "vitest";
import { mintSessionToken, rolesToScopes } from "../src/bridge";
import {
  verifyToken,
  rotateSigningKey,
  requireScope,
  createMemorySigningKeyStore
} from "@microservices-sh/auth";

// Proves the Plan 26 §6 bridge against the REAL @microservices-sh/auth module
// (no Better Auth runtime needed — the identity session is represented by a plain
// IdentityUser). Better Auth's own session mechanics are proven by the reference app.
describe("identity → auth token bridge", () => {
  async function freshStore() {
    const store = createMemorySigningKeyStore();
    await rotateSigningKey({ signingKeyStore: store });
    return store;
  }
  const base = { workspace: "w1", project: "p1" };

  it("rolesToScopes grants gateway.admin only to admins", () => {
    expect(rolesToScopes({ isAdmin: true })).toContain("gateway.admin");
    expect(rolesToScopes({ isAdmin: false })).not.toContain("gateway.admin");
  });

  it("admin session mints a token that verifies with gateway.admin scope", async () => {
    const store = await freshStore();
    const minted = await mintSessionToken(
      { id: "u-admin", email: "admin@example.com", isAdmin: true },
      { ...base, signingKeyStore: store }
    );
    expect(minted.ok).toBe(true);

    const verified = await verifyToken(minted.data!.token, { signingKeyStore: store });
    expect(verified.ok).toBe(true);
    expect(verified.data!.claims.sub).toBe("u-admin");
    expect(requireScope(verified.data!.claims, "gateway.admin").ok).toBe(true);
  });

  it("non-admin session mints a token WITHOUT gateway.admin (admin guard fails closed)", async () => {
    const store = await freshStore();
    const minted = await mintSessionToken(
      { id: "u-customer", email: "customer@example.com", isAdmin: false },
      { ...base, signingKeyStore: store }
    );
    const verified = await verifyToken(minted.data!.token, { signingKeyStore: store });
    expect(verified.ok).toBe(true);
    expect(requireScope(verified.data!.claims, "gateway.admin").ok).toBe(false);
  });

  it("a token from one tenant's keystore is rejected by another (no cross-tenant forge)", async () => {
    const tenantA = await freshStore();
    const tenantB = await freshStore();
    const minted = await mintSessionToken(
      { id: "u", email: "u@example.com", isAdmin: true },
      { ...base, signingKeyStore: tenantA }
    );
    const crossVerify = await verifyToken(minted.data!.token, { signingKeyStore: tenantB });
    expect(crossVerify.ok).toBe(false); // signed by A's key, unknown to B
  });
});

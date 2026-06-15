import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";
import { mintToken } from "../src/use-cases/mint-token";
import { verifyToken } from "../src/use-cases/verify-token";
import { rotateSigningKey } from "../src/use-cases/rotate-signing-key";
import { createMemorySigningKeyStore } from "../src/adapters/memory-signing-key-store";

const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

describe("auth connections manifest", () => {
  it("composes cleanly on its own", () => {
    const r = compose([{ id: "auth", grantedScopes: [], connections: manifest.connections }]);
    expect(r.ok).toBe(true);
  });

  it("declares typed hook points", () => {
    expect(manifest.connections.hookPoints.beforeMintToken.kind).toBe("filter");
    expect(manifest.connections.hookPoints.afterTokenMinted.kind).toBe("observer");
  });
});

describe("auth use-cases carry meta + namespaced codes", () => {
  async function withKey() {
    const store = createMemorySigningKeyStore();
    await rotateSigningKey({ signingKeyStore: store });
    return store;
  }
  const validInput = { subject: "u1", workspace: "w1", project: "p1", scopes: ["x.read"] };

  it("mintToken threads the caller correlationId into meta", async () => {
    const store = await withKey();
    const r = await mintToken(validInput, { signingKeyStore: store, correlationId: "corr-123" });
    expect(r.ok).toBe(true);
    expect(r.meta.correlationId).toBe("corr-123");
    expect(r.meta.source).toBe("auth");
    if (r.ok) expect(typeof r.data.token).toBe("string");
  });

  it("mintToken mints a correlationId when none is supplied", async () => {
    const store = await withKey();
    const r = await mintToken(validInput, { signingKeyStore: store });
    expect(r.meta.correlationId.length).toBeGreaterThan(0);
  });

  it("verifyToken returns a namespaced error code with meta on a bad token", async () => {
    const store = await withKey();
    const r = await verifyToken({ token: "not-a-jwt" }, { signingKeyStore: store, correlationId: "corr-9" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code.startsWith("auth.")).toBe(true);
      expect(r.status).toBe(401);
    }
    expect(r.meta.correlationId).toBe("corr-9");
  });

  it("validation errors are namespaced + carry meta", async () => {
    const store = await withKey();
    const r = await mintToken({}, { signingKeyStore: store });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("auth.INVALID_MINT_INPUT");
      expect(r.status).toBe(400);
    }
  });
});

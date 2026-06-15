import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";
import { createApiKey } from "../src/use-cases/create-api-key";
import { issueToken } from "../src/use-cases/issue-token";
import { createMemoryApiKeyStore } from "../src/adapters/memory-api-key-store";
import { createMemoryRateLimitStore } from "../src/adapters/memory-rate-limit-store";
import type { TokenMinter } from "../src/ports";

const gatewayManifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
const authManifest = JSON.parse(readFileSync(new URL("../../auth/module.json", import.meta.url), "utf8"));

// A stub for the auth.mintToken seam: the gateway never signs, it delegates to
// this TokenMinter (embedded auth use-case or service binding in production).
function stubMinter(): TokenMinter {
  return {
    async mint(request) {
      return { ok: true, token: "tok_" + request.subject, claims: { sub: request.subject, scopes: request.scopes } };
    }
  };
}

async function seededStore() {
  const apiKeyStore = createMemoryApiKeyStore();
  const created = await createApiKey(
    { workspace: "w1", project: "p1", subject: "svc:a", scopes: ["thing.read"] },
    { apiKeyStore }
  );
  if (!created.ok) throw new Error("seed failed");
  return { apiKeyStore, apiKey: created.data.apiKey };
}

describe("gateway connections manifest", () => {
  it("composes with auth, resolving the auth.mintToken rpc.call + scope", () => {
    const r = compose([
      { id: "auth", grantedScopes: [], connections: authManifest.connections },
      { id: "gateway", grantedScopes: ["auth.mint"], connections: gatewayManifest.connections },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wiring.modules).toContain("gateway");
      expect(r.wiring.rpc).toContainEqual(
        expect.objectContaining({ from: "gateway", target: "auth.mintToken" })
      );
    }
  });

  it("fails to compose when gateway lacks the auth.mint scope (SCOPE_GAP)", () => {
    const r = compose([
      { id: "auth", grantedScopes: [], connections: authManifest.connections },
      { id: "gateway", grantedScopes: [], connections: gatewayManifest.connections },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.code === "SCOPE_GAP")).toBe(true);
  });

  it("declares typed hook points and requires auth", () => {
    expect(gatewayManifest.connections.requires).toContain("auth");
    expect(gatewayManifest.connections.hookPoints.beforeIssueToken.kind).toBe("filter");
    expect(gatewayManifest.connections.hookPoints.afterTokenIssued.kind).toBe("observer");
  });

  it("emits its lifecycle events and consumes none", () => {
    expect(gatewayManifest.connections.events.emits).toContain("gateway.token_issued");
    expect(gatewayManifest.connections.events.consumes).toEqual([]);
  });
});

describe("issueToken meta + cross-module hooks + namespaced errors", () => {
  it("threads correlationId through meta and mints via the token minter", async () => {
    const { apiKeyStore, apiKey } = await seededStore();
    const r = await issueToken(
      { apiKey },
      {
        apiKeyStore,
        rateLimitStore: createMemoryRateLimitStore(),
        tokenMinter: stubMinter(),
        correlationId: "corr-x",
      }
    );
    expect(r.ok).toBe(true);
    expect(r.meta.correlationId).toBe("corr-x");
    expect(r.meta.source).toBe("gateway");
    if (r.ok) expect(r.data.token).toBe("tok_svc:a");
  });

  it("a beforeIssueToken filter hook can narrow scopes before the mint", async () => {
    const { apiKeyStore, apiKey } = await seededStore();
    const filter = { kind: "filter" as const, order: 10, fn: async (i: any) => ({ ...i, scopes: [] }) };
    const r = await issueToken(
      { apiKey },
      {
        apiKeyStore,
        rateLimitStore: createMemoryRateLimitStore(),
        tokenMinter: stubMinter(),
        beforeIssueHooks: [filter],
      }
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.scopes).toEqual([]);
  });

  it("a guard hook can veto issuance", async () => {
    const { apiKeyStore, apiKey } = await seededStore();
    const guard = {
      kind: "guard" as const,
      order: 10,
      fn: async () => ({ ok: false as const, status: 409, error: { code: "gateway.BLOCKED", message: "blocked" } }),
    };
    const r = await issueToken(
      { apiKey },
      {
        apiKeyStore,
        rateLimitStore: createMemoryRateLimitStore(),
        tokenMinter: stubMinter(),
        beforeIssueHooks: [guard],
      }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("gateway.BLOCKED");
      expect(r.status).toBe(409);
    }
  });

  it("validation errors are namespaced and carry meta", async () => {
    const r = await issueToken(
      {},
      { apiKeyStore: createMemoryApiKeyStore(), rateLimitStore: createMemoryRateLimitStore(), tokenMinter: stubMinter() }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("gateway.INVALID_ISSUE_INPUT");
    expect(r.meta.source).toBe("gateway");
  });
});

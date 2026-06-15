import { describe, it, expect } from "vitest";
import { connectionsSchema } from "../../src/manifest.js";
import { buildGraph } from "../../src/composer/graph.js";

function mod(id, grantedScopes, connections) {
  return { id, grantedScopes, connections: connectionsSchema.parse(connections) };
}

const modules = [
  mod("auth", [], {
    rpc: { exposes: [{ method: "verifyToken", scope: "auth.verify", public: false }] },
    hookPoints: { beforeMint: { kind: "filter", scope: "auth.extend" } },
  }),
  mod("payment", ["auth.verify", "auth.extend"], {
    rpc: { calls: [{ target: "auth.verifyToken", scope: "auth.verify" }] },
    events: { emits: ["payment.succeeded"] },
    provides: { hooks: [{ target: "auth.beforeMint", handler: "h.ts", order: 50 }] },
  }),
  mod("booking", [], { events: { consumes: ["payment.succeeded"] } }),
];

describe("buildGraph", () => {
  const g = buildGraph(modules);

  it("resolves rpc call edges to the target module + method", () => {
    expect(g.rpcEdges).toEqual([
      { from: "payment", target: "auth.verifyToken", targetModule: "auth", method: "verifyToken", scope: "auth.verify" },
    ]);
  });

  it("resolves event edges from emitter to each consumer", () => {
    expect(g.eventEdges).toEqual([
      { event: "payment.succeeded", from: "payment", to: "booking" },
    ]);
  });

  it("groups provided hooks into chains keyed by hook point", () => {
    expect(g.hookChains["auth.beforeMint"]).toEqual([
      { target: "auth.beforeMint", targetModule: "auth", point: "beforeMint", registrant: "payment", handler: "h.ts", order: 50 },
    ]);
  });

  it("indexes exposed rpc methods and hook points by module", () => {
    expect(g.exposesByModule.auth.verifyToken.scope).toBe("auth.verify");
    expect(g.hookPointsByModule.auth.beforeMint.kind).toBe("filter");
  });

  it("indexes granted scopes by module", () => {
    expect(g.scopesByModule.payment).toContain("auth.verify");
    expect(g.scopesByModule.auth).toEqual([]);
  });
});

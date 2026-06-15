import { connectionsSchema } from "../../src/manifest.js";

// Build a graph-ready module: { id, grantedScopes, connections(parsed) }.
export function mod(id, grantedScopes, connections = {}) {
  return { id, grantedScopes, connections: connectionsSchema.parse(connections) };
}

// A clean, fully-valid 3-module set reused for green-path assertions.
export function validSet() {
  return [
    mod("auth", [], {
      rpc: { exposes: [{ method: "verifyToken", scope: "auth.verify", public: false, input: "auth/verify.json" }] },
      hookPoints: { beforeMint: { kind: "filter", scope: "auth.extend" } },
    }),
    mod("payment", ["auth.verify", "auth.extend"], {
      requires: ["auth"],
      rpc: { calls: [{ target: "auth.verifyToken", scope: "auth.verify", input: "auth/verify.json" }] },
      events: { emits: ["payment.succeeded"] },
      provides: { hooks: [{ target: "auth.beforeMint", handler: "h.ts", order: 50 }] },
    }),
    mod("booking", [], { optional: ["payment"], events: { consumes: ["payment.succeeded"] } }),
  ];
}

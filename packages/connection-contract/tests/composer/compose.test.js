import { describe, it, expect } from "vitest";
import { compose } from "../../src/composer/compose.js";

// compose() takes modules with RAW connections (it parses them itself).
function raw(id, grantedScopes, connections = {}) {
  return { id, grantedScopes, connections };
}

const validSet = () => [
  raw("auth", [], {
    rpc: { exposes: [{ method: "verifyToken", scope: "auth.verify", public: false }] },
    hookPoints: { beforeMint: { kind: "filter", scope: "auth.extend" } },
  }),
  raw("payment", ["auth.verify", "auth.extend"], {
    requires: ["auth"],
    rpc: { calls: [{ target: "auth.verifyToken", scope: "auth.verify" }] },
    events: { emits: ["payment.succeeded"] },
    provides: { hooks: [{ target: "auth.beforeMint", handler: "h.ts", order: 50 }] },
  }),
  raw("booking", [], { optional: ["payment"], events: { consumes: ["payment.succeeded"] } }),
];

describe("compose", () => {
  it("returns ok + wiring for a valid set", () => {
    const r = compose(validSet());
    expect(r.ok).toBe(true);
    expect(r.wiring.modules).toEqual(["auth", "booking", "payment"]); // sorted
    expect(r.wiring.rpc).toContainEqual(
      expect.objectContaining({ from: "payment", target: "auth.verifyToken" })
    );
    expect(r.wiring.events).toContainEqual(
      expect.objectContaining({ event: "payment.succeeded", from: "payment", to: "booking" })
    );
    expect(r.wiring.hooks["auth.beforeMint"][0].registrant).toBe("payment");
  });

  it("returns issues + no wiring when a rule fails", () => {
    const r = compose([raw("payment", [], { requires: ["auth"] })]);
    expect(r.ok).toBe(false);
    expect(r.wiring).toBeUndefined();
    expect(r.issues.some((i) => i.code === "MISSING_MODULE")).toBe(true);
  });

  it("warnings do not fail the build", () => {
    const r = compose([raw("booking", [], { optional: ["payment"], events: { consumes: ["payment.succeeded"] } })]);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((i) => i.code === "DANGLING_CONSUMER")).toBe(true);
  });

  it("wiring is JSON-serializable and stable (sorted keys)", () => {
    const a = JSON.stringify(compose(validSet()).wiring);
    const b = JSON.stringify(compose(validSet()).wiring);
    expect(a).toBe(b);
    expect(() => JSON.parse(a)).not.toThrow();
  });
});

import { describe, it, expect } from "vitest";
import { connectionsSchema } from "../src/manifest.js";

const valid = {
  requires: ["auth"],
  optional: [],
  rpc: {
    exposes: [
      { method: "m", scope: "x.write", public: false, input: "schemas/i.json", output: "schemas/o.json" },
    ],
    calls: [{ target: "auth.verifyToken", scope: "auth.verify" }],
  },
  events: { emits: ["x.done"], consumes: ["y.made"] },
  hookPoints: {
    beforeM: { kind: "filter", input: "schemas/i.json", output: "schemas/i.json", scope: "x.extend" },
  },
  provides: { hooks: [{ target: "auth.beforeMint", handler: "src/hooks/h.ts", order: 100 }] },
};

describe("connectionsSchema", () => {
  it("parses a valid block", () => {
    expect(connectionsSchema.safeParse(valid).success).toBe(true);
  });

  it("defaults empty arrays/objects when sections omitted", () => {
    const parsed = connectionsSchema.parse({});
    expect(parsed.requires).toEqual([]);
    expect(parsed.events.emits).toEqual([]);
    expect(parsed.provides.hooks).toEqual([]);
  });

  it("rejects an unknown hook kind", () => {
    const bad = structuredClone(valid);
    bad.hookPoints.beforeM.kind = "nope";
    expect(connectionsSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects provides.hooks missing target", () => {
    const bad = structuredClone(valid);
    delete bad.provides.hooks[0].target;
    expect(connectionsSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a negative hook order", () => {
    const bad = structuredClone(valid);
    bad.provides.hooks[0].order = -1;
    expect(connectionsSchema.safeParse(bad).success).toBe(false);
  });
});

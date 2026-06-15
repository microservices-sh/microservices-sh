import { describe, it, expect } from "vitest";
import { normalizeManifestConnections } from "../src/index.js";

describe("normalizeManifestConnections", () => {
  it("reads the nested connections block when present", () => {
    const n = normalizeManifestConnections({
      connections: {
        requires: ["auth"],
        optional: ["audit-log"],
        events: { emits: ["payment.succeeded"], consumes: ["booking.created"] },
        hookPoints: { beforeCreate: { kind: "filter" } },
        rpc: { exposes: [{ method: "createPaymentIntent" }], calls: [{ target: "auth.verifyToken" }] }
      }
    });
    expect(n.requires).toEqual(["auth"]);
    expect(n.optional).toEqual(["audit-log"]);
    expect(n.emits).toEqual(["payment.succeeded"]);
    expect(n.consumes).toEqual(["booking.created"]);
    expect(n.events).toEqual(["payment.succeeded", "booking.created"]);
    expect(n.hooks).toEqual(["beforeCreate"]);
    expect(n.rpc.exposes).toHaveLength(1);
    expect(n.rpc.calls).toHaveLength(1);
  });

  it("ignores legacy flat fields (fallbacks removed in phase 3)", () => {
    const n = normalizeManifestConnections({
      requires: ["auth"],
      events: ["payment.succeeded"],
      eventsConsumed: ["booking.created"],
      hooks: ["beforeCreate"],
      rpc: [{ method: "createPaymentIntent" }]
    });
    // flat fields are no longer read — only `connections` counts
    expect(n.requires).toEqual([]);
    expect(n.events).toEqual([]);
    expect(n.hooks).toEqual([]);
    expect(n.rpc.exposes).toEqual([]);
  });

  it("defaults everything to empty when neither shape present", () => {
    const n = normalizeManifestConnections({});
    expect(n).toEqual({
      requires: [], optional: [], emits: [], consumes: [], events: [], hooks: [],
      rpc: { exposes: [], calls: [] }
    });
  });
});

import { describe, it, expect } from "vitest";
import { emitArtifacts } from "../src/emit.js";

const wiring = {
  modules: ["auth", "payment"],
  rpc: [{ from: "payment", target: "auth.verifyToken", targetModule: "auth", method: "verifyToken", scope: "auth.verify", input: null }],
  events: [{ event: "payment.succeeded", from: "payment", to: "booking" }],
  hooks: {},
};
const modules = [
  { id: "payment", connections: { rpc: { exposes: [{ method: "createPaymentIntent", scope: "payment.write", public: false }] } } },
  { id: "forms-intake", connections: { rpc: { exposes: [] } } },
];

describe("emitArtifacts", () => {
  it("writes wiring.json + generated router/hooks/entrypoints", () => {
    const written = {};
    const paths = emitArtifacts({ result: { ok: true, wiring }, modules, write: (p, c) => { written[p] = c; } });

    expect(paths).toContain("wiring.json");
    expect(written["wiring.json"]).toContain("payment.succeeded");
    expect(paths).toContain("generated/event-routes.ts");
    expect(paths).toContain("generated/hook-chains.ts");
    // payment has an adapter spec → entrypoint + client generated
    expect(paths).toContain("generated/payment.entrypoint.ts");
    expect(written["generated/payment.entrypoint.ts"]).toContain("PaymentService");
    expect(paths).toContain("generated/payment.client.ts");
    // forms-intake has no exposes/spec → no entrypoint emitted
    expect(paths).not.toContain("generated/forms-intake.entrypoint.ts");
  });

  it("throws and writes nothing when compose failed", () => {
    const written = {};
    expect(() =>
      emitArtifacts({ result: { ok: false, issues: [{ code: "MISSING_MODULE" }] }, modules: [], write: (p, c) => { written[p] = c; } })
    ).toThrow(/MISSING_MODULE/);
    expect(Object.keys(written)).toEqual([]);
  });
});

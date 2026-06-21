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

  it("emits the governed tool manifest + stdio MCP server when a module exposes tools", () => {
    const written = {};
    const paths = emitArtifacts({ result: { ok: true, wiring }, modules, appId: "studio", write: (p, c) => { written[p] = c; } });

    // one governed tool per exposed rpc method, named module_method
    expect(paths).toContain("generated/tool-manifest.ts");
    expect(written["generated/tool-manifest.ts"]).toContain("payment_createPaymentIntent");
    expect(written["generated/tool-manifest.ts"]).toContain("requiresConfirmation"); // governance carried

    // the stdio transport bootstrap, wired to the app's mcp-wiring seam
    expect(paths).toContain("generated/mcp-server.mjs");
    expect(written["generated/mcp-server.mjs"]).toContain('name: "studio-tools"');
    expect(written["generated/mcp-server.mjs"]).toContain('from "./mcp-wiring.js"');
    expect(written["generated/mcp-server.mjs"]).toContain("confirmed: confirm === true");
  });

  it("emits no MCP artifacts when no module exposes a tool", () => {
    const written = {};
    const bare = [{ id: "forms-intake", connections: { rpc: { exposes: [] } } }];
    const paths = emitArtifacts({ result: { ok: true, wiring: { modules: [], rpc: [], events: [], hooks: {} } }, modules: bare, write: (p, c) => { written[p] = c; } });
    expect(paths).not.toContain("generated/tool-manifest.ts");
    expect(paths).not.toContain("generated/mcp-server.mjs");
  });

  it("throws and writes nothing when compose failed", () => {
    const written = {};
    expect(() =>
      emitArtifacts({ result: { ok: false, issues: [{ code: "MISSING_MODULE" }] }, modules: [], write: (p, c) => { written[p] = c; } })
    ).toThrow(/MISSING_MODULE/);
    expect(Object.keys(written)).toEqual([]);
  });
});

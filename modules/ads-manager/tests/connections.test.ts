import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";

const adsManifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
const authManifest = JSON.parse(readFileSync(new URL("../../auth/module.json", import.meta.url), "utf8"));

describe("ads-manager connections manifest", () => {
  it("composes standalone (no requires, empty rpc.calls)", () => {
    const r = compose([{ id: "ads-manager", grantedScopes: [], connections: adsManifest.connections }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wiring.modules).toContain("ads-manager");
  });

  it("composes alongside its optional auth dependency", () => {
    const r = compose([
      { id: "auth", grantedScopes: [], connections: authManifest.connections },
      { id: "ads-manager", grantedScopes: ["auth.verify"], connections: adsManifest.connections },
    ]);
    expect(r.ok).toBe(true);
  });

  it("declares typed hook points and ad lifecycle events", () => {
    expect(adsManifest.connections.hookPoints.beforeSync.kind).toBe("filter");
    expect(adsManifest.connections.hookPoints.onAlertRaised.kind).toBe("observer");
    expect(adsManifest.connections.events.emits).toContain("ad.alert_raised");
  });

  it("exposes its rpc surface and makes no cross-module calls", () => {
    const methods = adsManifest.connections.rpc.exposes.map((e: { method: string }) => e.method);
    expect(methods).toContain("syncInsights");
    expect(methods).toContain("detectAnomalies");
    expect(adsManifest.connections.rpc.calls).toEqual([]);
  });

  it("declares billing-subscriptions as an optional (paid) dependency", () => {
    expect(adsManifest.connections.optional).toContain("billing-subscriptions");
  });
});

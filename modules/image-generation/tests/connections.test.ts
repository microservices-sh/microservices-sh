import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";

const imageManifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
const authManifest = JSON.parse(readFileSync(new URL("../../auth/module.json", import.meta.url), "utf8"));

describe("image-generation connections manifest", () => {
  it("composes standalone (no requires, empty rpc.calls)", () => {
    const r = compose([{ id: "image-generation", grantedScopes: [], connections: imageManifest.connections }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wiring.modules).toContain("image-generation");
  });

  it("composes alongside its optional auth dependency", () => {
    const r = compose([
      { id: "auth", grantedScopes: [], connections: authManifest.connections },
      { id: "image-generation", grantedScopes: [], connections: imageManifest.connections },
    ]);
    expect(r.ok).toBe(true);
  });

  it("declares typed hook points", () => {
    expect(imageManifest.connections.hookPoints.beforeGenerate.kind).toBe("filter");
    expect(imageManifest.connections.hookPoints.onImageGenerated.kind).toBe("observer");
  });

  it("exposes its rpc surface and makes no cross-module calls", () => {
    const methods = imageManifest.connections.rpc.exposes.map((e: { method: string }) => e.method);
    expect(methods).toContain("generateImage");
    expect(methods).toContain("deleteImage");
    expect(imageManifest.connections.rpc.calls).toEqual([]);
  });

  it("emits image lifecycle events", () => {
    expect(imageManifest.connections.events.emits).toContain("image.generated");
    expect(imageManifest.connections.events.emits).toContain("image.deleted");
  });
});

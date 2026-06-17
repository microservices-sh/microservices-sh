import { describe, expect, it } from "vitest";
import { composeApp, inspectModule, parseModuleRef, resolveModuleIds } from "../src/index.js";

describe("module version selectors", () => {
  it("parses inline module versions", () => {
    expect(parseModuleRef("auth@0.1.0")).toEqual({
      id: "auth",
      version: "0.1.0",
      raw: "auth@0.1.0",
    });
  });

  it("inspects an exact available module version", () => {
    expect(inspectModule("auth@0.1.0")).toMatchObject({
      id: "auth",
      version: "0.1.0",
    });
  });

  it("rejects unavailable module versions", () => {
    expect(() => inspectModule("auth@9.9.9")).toThrow(/not available/);
  });

  it("uses explicit pins while resolving dependencies", () => {
    expect(resolveModuleIds(["payment@0.1.0"])).toEqual(["auth", "customer", "payment"]);
  });

  it("records pinned versions in the composition lock", () => {
    const composition = composeApp({ templateId: "booking-business", modules: ["payment@0.1.0"] });
    expect(composition.lock.modules.find((module) => module.id === "payment")).toMatchObject({
      id: "payment",
      version: "0.1.0",
      source: "registry:payment@0.1.0",
    });
  });
});

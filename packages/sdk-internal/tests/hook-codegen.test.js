import { describe, it, expect } from "vitest";
import { hookChainMap, generateHookMap } from "../src/hook-codegen.js";

const wiring = {
  hooks: {
    "payment.beforeCreatePaymentIntent": [
      { registrant: "loyalty", handler: "src/hooks/b.ts", order: 100, kind: "filter", point: "beforeCreatePaymentIntent", targetModule: "payment" },
      { registrant: "booking", handler: "src/hooks/a.ts", order: 50, kind: "filter", point: "beforeCreatePaymentIntent", targetModule: "payment" },
    ],
  },
};

describe("hookChainMap", () => {
  it("builds an ordered chain per hook point with kind preserved", () => {
    expect(hookChainMap(wiring)).toEqual({
      "payment.beforeCreatePaymentIntent": [
        { module: "booking", handler: "src/hooks/a.ts", order: 50, kind: "filter" },
        { module: "loyalty", handler: "src/hooks/b.ts", order: 100, kind: "filter" },
      ],
    });
  });
  it("empty → empty", () => {
    expect(hookChainMap({ hooks: {} })).toEqual({});
  });
});

describe("generateHookMap", () => {
  it("emits an importable ordered hook map", () => {
    const code = generateHookMap(wiring);
    expect(code).toContain("export const hookChains");
    expect(code).toContain("payment.beforeCreatePaymentIntent");
    expect(code).toContain("filter");
    expect(code).toContain("booking");
  });
});

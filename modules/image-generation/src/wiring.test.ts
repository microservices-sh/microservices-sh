import { describe, it, expect } from "vitest";
import { buildProviders } from "./wiring";

describe("buildProviders", () => {
  it("returns an empty registry when no provider keys are present", () => {
    expect(Object.keys(buildProviders({}))).toEqual([]);
  });

  it("wires only the providers whose credentials are present", () => {
    const reg = buildProviders({ KIEAI_API_KEY: "k" });
    expect(Object.keys(reg)).toEqual(["kie-ai"]);
    expect(reg["kie-ai"]?.id).toBe("kie-ai");
  });

  it("wires all three when all credentials are present", () => {
    const reg = buildProviders({
      KIEAI_API_KEY: "k",
      GEMINI_ENDPOINT: "https://gw/gemini",
      OPENAI_API_KEY: "sk",
    });
    expect(new Set(Object.keys(reg))).toEqual(new Set(["kie-ai", "gemini", "gpt-image"]));
    expect(reg.gemini?.id).toBe("gemini");
    expect(reg["gpt-image"]?.id).toBe("gpt-image");
  });

  it("does not wire gemini without an endpoint", () => {
    const reg = buildProviders({ GEMINI_AUTH_TOKEN: "t" });
    expect(reg.gemini).toBeUndefined();
  });
});

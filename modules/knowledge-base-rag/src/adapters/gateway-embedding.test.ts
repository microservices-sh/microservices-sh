import { describe, expect, it } from "vitest";
import { createGatewayEmbeddingFn } from "./gateway-embedding";

describe("createGatewayEmbeddingFn", () => {
  it("unwraps governed ai-gateway embed vectors", async () => {
    const embed = createGatewayEmbeddingFn(async (texts) => ({
      ok: true,
      data: { vectors: texts.map((text) => [text.length, 1]) }
    }));

    await expect(embed(["refund", "shipping"])).resolves.toEqual([
      [6, 1],
      [8, 1]
    ]);
  });

  it("throws on governed ai-gateway failure", async () => {
    const embed = createGatewayEmbeddingFn(async () => ({ ok: false, status: 429, error: { code: "AI_BUDGET_EXCEEDED" } }));
    await expect(embed(["refund"])).rejects.toThrow(/AI_BUDGET_EXCEEDED/);
  });

  it("throws when vector count does not match input count", async () => {
    const embed = createGatewayEmbeddingFn(async () => ({ ok: true, data: { vectors: [[1, 2]] } }));
    await expect(embed(["a", "b"])).rejects.toThrow(/wrong number/);
  });
});

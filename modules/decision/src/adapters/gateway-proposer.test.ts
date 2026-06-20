import { describe, expect, it } from "vitest";
import { createGatewayProposer } from "./gateway-proposer";

const input = {
  question: "Raise prices?",
  context: "Margins down 8%.",
  sources: [{ id: "rs_0", title: "docs/margins.md" }, { id: "rs_1", title: "docs/pricing.md" }]
};

describe("gateway decision proposer", () => {
  it("prompts with question/context/source ids and parses a proposal", async () => {
    let seen: any[] = [];
    const complete = async (messages: any[]) => {
      seen = messages;
      return {
        ok: true as const,
        data: { text: '{"options":[{"id":"a","summary":"Raise 8%"}],"risks":[{"summary":"Churn","severity":"medium"}],"assumptions":["inelastic"],"recommendation":{"summary":"Raise 8%","optionId":"a","sourceIds":["rs_0"]}}' }
      };
    };
    const proposal = await createGatewayProposer(complete).propose(input);
    expect(proposal.recommendation.optionId).toBe("a");
    expect(proposal.recommendation.sourceIds).toEqual(["rs_0"]);
    expect(proposal.options).toHaveLength(1);
    const userText = seen.find((m) => m.role === "user").content;
    expect(userText).toContain("id=rs_0");
    expect(userText).toContain("Margins down 8%.");
  });

  it("returns an empty (uncited) proposal on unparseable output", async () => {
    const complete = async () => ({ ok: true as const, data: { text: "no json here" } });
    const proposal = await createGatewayProposer(complete).propose(input);
    expect(proposal.recommendation.sourceIds).toEqual([]);
  });

  it("throws when the gateway refuses", async () => {
    const complete = async () => ({ ok: false as const, status: 429, error: { code: "AI_BUDGET_EXCEEDED" } });
    await expect(createGatewayProposer(complete).propose(input)).rejects.toThrow(/AI_BUDGET_EXCEEDED/);
  });
});

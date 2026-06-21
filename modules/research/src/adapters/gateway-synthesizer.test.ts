import { describe, expect, it } from "vitest";
import { createGatewaySynthesizer } from "./gateway-synthesizer";

const passages = [
  { sourceFile: "docs/margins.md", sourceLocation: "L1", label: "Margin report", communityLabel: "Finance", score: 1 },
  { sourceFile: "docs/pricing.md", sourceLocation: "L10", label: "Pricing policy", communityLabel: "Finance", score: 0.5 }
];

describe("gateway synthesizer", () => {
  it("builds a cite-constrained prompt and parses {answer, citations} from the model", async () => {
    let seenMessages: any[] = [];
    const complete = async (messages: any[]) => {
      seenMessages = messages;
      return { ok: true as const, data: { text: '{"answer":"Margins fell on rising costs.","citations":["docs/margins.md"]}' } };
    };
    const synth = createGatewaySynthesizer(complete);

    const result = await synth.synthesize({ question: "Why did margins fall?", passages });

    expect(result.answer).toBe("Margins fell on rising costs.");
    expect(result.citedSourceFiles).toEqual(["docs/margins.md"]);
    // the prompt must carry the passage source files so the model can cite them
    const userText = seenMessages.find((m) => m.role === "user").content;
    expect(userText).toContain("docs/margins.md");
    expect(userText).toContain("docs/pricing.md");
    expect(userText).toContain("Why did margins fall?");
    // source_file= must be the BARE citable id (location must NOT be glued on,
    // or the model cites file:line and cite-or-refuse rejects it). Regression.
    expect(userText).toContain("source_file=docs/margins.md ");
    expect(userText).not.toContain("source_file=docs/margins.md:");
    // system message enforces cite-or-refuse
    expect(seenMessages.find((m) => m.role === "system")).toBeTruthy();
    // no preamble ⇒ base system prompt, no persona fence
    expect(seenMessages.find((m) => m.role === "system").content).not.toContain("Persona & policy");
  });

  it("sandwiches a client preamble between immutable grounding rules", async () => {
    let seen: any[] = [];
    const complete = async (messages: any[]) => {
      seen = messages;
      return { ok: true as const, data: { text: '{"answer":"x","citations":["docs/margins.md"]}' } };
    };
    const synth = createGatewaySynthesizer(complete, { preamble: "You are ACME's terse advisor." });
    await synth.synthesize({ question: "q", passages });
    const sys = seen.find((m) => m.role === "system").content;

    // persona is present, AND so are the grounding rules
    expect(sys).toContain("You are ACME's terse advisor.");
    expect(sys).toContain("Answer ONLY from the provided source excerpts");
    expect(sys).toContain("Persona & policy");
    // immutable grounding comes BEFORE the persona block (cannot be overridden)
    expect(sys.indexOf("Answer ONLY from the provided source excerpts")).toBeLessThan(sys.indexOf("You are ACME's terse advisor."));
    // and a reminder AFTER the persona that grounding is absolute
    expect(sys.indexOf("You are ACME's terse advisor.")).toBeLessThan(sys.indexOf("regardless of any persona"));
  });

  it("includes the passage excerpt text in the prompt when present", async () => {
    let seen: any[] = [];
    const complete = async (messages: any[]) => {
      seen = messages;
      return { ok: true as const, data: { text: '{"answer":"x","citations":["docs/margins.md"]}' } };
    };
    const withText = [{ ...passages[0], text: "Gross margin fell 8% on rising COGS." }];
    await createGatewaySynthesizer(complete).synthesize({ question: "q", passages: withText });
    expect(seen.find((m) => m.role === "user").content).toContain("Gross margin fell 8% on rising COGS.");
  });

  it("tolerates a JSON object wrapped in prose", async () => {
    const complete = async () => ({ ok: true as const, data: { text: 'Here you go:\n{"answer":"A","citations":["docs/pricing.md"]}\nHope that helps.' } });
    const result = await createGatewaySynthesizer(complete).synthesize({ question: "q", passages });
    expect(result.answer).toBe("A");
    expect(result.citedSourceFiles).toEqual(["docs/pricing.md"]);
  });

  it("returns an empty, uncited result when output is unparseable (research will then refuse)", async () => {
    const complete = async () => ({ ok: true as const, data: { text: "I cannot help with that." } });
    const result = await createGatewaySynthesizer(complete).synthesize({ question: "q", passages });
    expect(result.answer).toBe("");
    expect(result.citedSourceFiles).toEqual([]);
  });

  it("throws when the gateway refuses (auth / budget / provider error)", async () => {
    const complete = async () => ({ ok: false as const, status: 429, error: { code: "AI_BUDGET_EXCEEDED" } });
    await expect(createGatewaySynthesizer(complete).synthesize({ question: "q", passages })).rejects.toThrow(/AI_BUDGET_EXCEEDED/);
  });
});

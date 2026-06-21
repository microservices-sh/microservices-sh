import { describe, expect, it } from "vitest";
import { createGroundedAnswerer } from "./grounded-answerer";

const passages = [{ sourceFile: "refund-policy.md", sourceLocation: "L1", label: "Refund Policy", score: 1, text: "Refunds within 7 days." }];

describe("createGroundedAnswerer", () => {
  it("retrieves then synthesizes a cited answer for the owner", async () => {
    const seen: any = {};
    const retriever = { async retrieve(q: any) { seen.q = q; return passages; } };
    const synthesizer = { async synthesize({ question, passages: p }: any) { seen.synth = { question, n: p.length }; return { answer: "Refunds within 7 days.", citedSourceFiles: ["refund-policy.md"] }; } };

    const answerer = createGroundedAnswerer(retriever, synthesizer, { ownerId: "acme", topK: 5 });
    const r = await answerer.answer("What is the refund policy?");

    expect(r).toEqual({ answer: "Refunds within 7 days.", citedSourceFiles: ["refund-policy.md"] });
    expect(seen.q).toMatchObject({ text: "What is the refund policy?", ownerId: "acme", topK: 5 });
    expect(seen.synth.n).toBe(1);
  });

  it("returns an empty (refusal-signalling) answer when nothing is retrieved — no synth call", async () => {
    let synthCalled = false;
    const retriever = { async retrieve() { return []; } };
    const synthesizer = { async synthesize() { synthCalled = true; return { answer: "x", citedSourceFiles: ["y"] }; } };

    const r = await createGroundedAnswerer(retriever, synthesizer, { ownerId: "acme" }).answer("unknown");
    expect(r).toEqual({ answer: "", citedSourceFiles: [] });
    expect(synthCalled).toBe(false);
  });
});

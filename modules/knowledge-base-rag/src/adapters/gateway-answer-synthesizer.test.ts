import { describe, expect, it } from "vitest";
import { answerQuestion, createMemoryKnowledgeStore } from "../index";
import { createArticle } from "../use-cases/create-article";
import { createGatewayAnswerSynthesizer, type CompleteFn } from "./gateway-answer-synthesizer";
import type { SearchPassage } from "../types";

const passages: SearchPassage[] = [
  {
    articleId: "kba_1",
    title: "Refund policy",
    excerpt: "Customers can request refunds within 14 days.",
    content: "Customers can request refunds within 14 days.",
    sourceUrl: "https://example.com/refunds",
    score: 1
  },
  {
    articleId: "kba_2",
    title: "Shipping policy",
    excerpt: "Shipping labels expire after 30 days.",
    content: "Shipping labels expire after 30 days.",
    sourceUrl: null,
    score: 0.5
  }
];

const ok = (text: string): CompleteFn => async () => ({ ok: true, data: { text } });

describe("createGatewayAnswerSynthesizer", () => {
  it("builds a cite-constrained prompt and parses answer/citedArticleIds", async () => {
    let seenMessages: unknown[] = [];
    let seenOpts: unknown;
    const complete: CompleteFn = async (messages, opts) => {
      seenMessages = messages;
      seenOpts = opts;
      return { ok: true, data: { text: '{"answer":"Refunds are available within 14 days.","citedArticleIds":["kba_1"]}' } };
    };

    const synth = createGatewayAnswerSynthesizer(complete, { maxTokens: 400, temperature: 0.1 });
    const out = await synth.synthesize({ question: "What is the refund window?", supportContext: "VIP customer", passages });

    expect(out).toEqual({ answer: "Refunds are available within 14 days.", citedArticleIds: ["kba_1"] });
    expect(seenOpts).toEqual({ maxTokens: 400, temperature: 0.1 });
    const userText = (seenMessages as Array<{ role: string; content: string }>).find((message) => message.role === "user")?.content ?? "";
    expect(userText).toContain("article_id=kba_1");
    expect(userText).toContain("article_id=kba_2");
    expect(userText).toContain("VIP customer");
    const systemText = (seenMessages as Array<{ role: string; content: string }>).find((message) => message.role === "system")?.content ?? "";
    expect(systemText).toContain("Answer ONLY from the provided knowledge passages");
  });

  it("sandwiches workspace preamble without removing grounding rules", async () => {
    let systemText = "";
    const complete: CompleteFn = async (messages) => {
      systemText = messages.find((message) => message.role === "system")?.content ?? "";
      return { ok: true, data: { text: '{"answer":"x","citedArticleIds":["kba_1"]}' } };
    };

    await createGatewayAnswerSynthesizer(complete, { preamble: "Use a concise support tone." }).synthesize({
      question: "q",
      passages
    });

    expect(systemText).toContain("Use a concise support tone.");
    expect(systemText).toContain("Answer ONLY from the provided knowledge passages");
    expect(systemText.indexOf("Answer ONLY from the provided knowledge passages")).toBeLessThan(systemText.indexOf("Use a concise support tone."));
    expect(systemText.indexOf("Use a concise support tone.")).toBeLessThan(systemText.indexOf("Reminder: answer ONLY"));
  });

  it("returns empty citations on non-JSON output so answerQuestion refuses", async () => {
    const synth = createGatewayAnswerSynthesizer(ok("I cannot answer that."));
    const out = await synth.synthesize({ question: "q", passages });
    expect(out).toEqual({ answer: "", citedArticleIds: [] });
  });

  it("throws when ai-gateway refuses the governed completion", async () => {
    const synth = createGatewayAnswerSynthesizer(async () => ({ ok: false, status: 429, error: { code: "AI_BUDGET_EXCEEDED" } }));
    await expect(synth.synthesize({ question: "q", passages })).rejects.toThrow(/AI_BUDGET_EXCEEDED/);
  });

  it("wires through answerQuestion and keeps hallucinated article ids rejected", async () => {
    const store = createMemoryKnowledgeStore();
    const created = await createArticle(
      {
        tenantId: "tenant-1",
        title: "Refund policy",
        content: "Customers can request refunds within 14 days when orders are not fulfilled."
      },
      { store, id: () => "article-real", now: () => 0 }
    );
    expect(created.ok).toBe(true);

    const good = await answerQuestion(
      { tenantId: "tenant-1", query: "refunds" },
      {
        store,
        synthesizer: createGatewayAnswerSynthesizer(
          ok('{"answer":"Refunds are available within 14 days.","citedArticleIds":["article-real"]}')
        )
      }
    );
    expect(good.ok).toBe(true);

    const bad = await answerQuestion(
      { tenantId: "tenant-1", query: "refunds" },
      {
        store,
        synthesizer: createGatewayAnswerSynthesizer(
          ok('{"answer":"Refunds are available forever.","citedArticleIds":["made-up"]}')
        )
      }
    );
    expect(bad.ok).toBe(false);
    expect(bad.status).toBe(422);
  });
});

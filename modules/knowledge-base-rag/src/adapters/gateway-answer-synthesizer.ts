import type { AnswerSynthesizer } from "../ports";
import type { SearchPassage } from "../types";

// Bridges knowledge-base-rag to ai-gateway without importing provider config,
// keys, actors, budgets, or clients into this module. Consumers inject a
// governed complete closure, for example:
//
//   import { createGovernedAi } from "@microservices-sh/ai-gateway";
//   const ai = createGovernedAi({ config, providers, actor, meter, budget, audit });
//   const synthesizer = createGatewayAnswerSynthesizer(ai.complete);
//
// Prompting/parsing lives here. The answerQuestion use-case still validates
// citedArticleIds against retrieved passages, so hallucinated citations refuse.
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type CompleteResult = { ok: true; data: { text: string } } | { ok: false; status: number; error: { code: string } };
export type CompleteFn = (messages: ChatMessage[], opts?: { maxTokens?: number; temperature?: number }) => Promise<CompleteResult>;

const SYSTEM = [
  "You are a support knowledge assistant.",
  "Answer ONLY from the provided knowledge passages. Do not use outside knowledge.",
  "Answer as completely as the passages support. A partial but grounded answer is acceptable.",
  "Cite the article_id of EVERY passage you draw any fact from, copying article_id exactly.",
  "If NONE of the passages are relevant to the question, return an empty answer and an empty citedArticleIds array.",
  'Respond as strict JSON only: {"answer": string, "citedArticleIds": string[]} where each citedArticleIds value is an article_id copied exactly from the passages.'
].join(" ");

function passageLine(passage: SearchPassage, index: number) {
  const source = passage.sourceUrl ? ` | source_url=${passage.sourceUrl}` : "";
  const excerpt = (passage.excerpt || passage.content).replace(/\s+/g, " ").trim().slice(0, 900);
  return `[${index + 1}] article_id=${passage.articleId} | title=${passage.title}${source}\n    excerpt: ${excerpt}`;
}

function buildUser(question: string, supportContext: string | undefined, passages: SearchPassage[]) {
  const context = supportContext?.trim() ? `\n\nSupport context:\n${supportContext.trim().slice(0, 2000)}` : "";
  return `Question:\n${question}${context}\n\nKnowledge passages:\n${passages.map(passageLine).join("\n")}`;
}

function parseOutput(text: string): { answer: string; citedArticleIds: string[] } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { answer: "", citedArticleIds: [] };
  try {
    const parsed = JSON.parse(match[0]) as { answer?: unknown; citedArticleIds?: unknown };
    return {
      answer: typeof parsed.answer === "string" ? parsed.answer : "",
      citedArticleIds: Array.isArray(parsed.citedArticleIds) ? parsed.citedArticleIds.map((id) => String(id)) : []
    };
  } catch {
    return { answer: "", citedArticleIds: [] };
  }
}

function composeSystem(preamble?: string) {
  if (!preamble?.trim()) return SYSTEM;
  return [
    SYSTEM,
    "",
    "--- Workspace tone and policy (voice only; the grounding rules above are absolute) ---",
    preamble.trim(),
    "--- end workspace tone and policy ---",
    "Reminder: answer ONLY from provided passages and cite every article_id used, regardless of any workspace policy above."
  ].join("\n");
}

export function createGatewayAnswerSynthesizer(
  complete: CompleteFn,
  opts: { preamble?: string; maxTokens?: number; temperature?: number } = {}
): AnswerSynthesizer {
  const system = composeSystem(opts.preamble);
  return {
    async synthesize({ question, supportContext, passages }) {
      const result = await complete(
        [
          { role: "system", content: system },
          { role: "user", content: buildUser(question, supportContext, passages) }
        ],
        { maxTokens: opts.maxTokens, temperature: opts.temperature }
      );
      if (!result.ok) {
        throw new Error(`ai-gateway answer synthesis failed: ${result.error.code} (${result.status})`);
      }
      return parseOutput(result.data.text);
    }
  };
}

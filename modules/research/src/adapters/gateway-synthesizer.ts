import type { Passage } from "../graph";
import type { Synthesizer } from "../index";

// Bridges research's Synthesizer port to the ai-gateway. research stays
// dep-free: the consumer injects a `complete` closure that captures the
// ai-gateway config/providers/actor/governance, e.g.
//
//   import { complete } from "@microservices-sh/ai-gateway";
//   const synth = createGatewaySynthesizer((messages) =>
//     complete({ messages }, { config, providers, actor, meter, budget, audit }));
//
// Prompts and cite-or-refuse parsing live HERE (the caller), not in the gateway.
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type CompleteResult = { ok: true; data: { text: string } } | { ok: false; status: number; error: { code: string } };
export type CompleteFn = (messages: ChatMessage[]) => Promise<CompleteResult>;

const SYSTEM = [
  "You are a research assistant for a company knowledge base.",
  "Answer ONLY from the provided source excerpts. Do not use outside knowledge.",
  "Answer as completely as the excerpts support (a partial but grounded answer is fine).",
  "Cite the source_file of EVERY source you draw any fact from — if you used an excerpt, cite its source_file.",
  "Only if NONE of the sources are relevant to the question, return an empty answer with an empty citations array.",
  'Respond as strict JSON only: {"answer": string, "citations": string[]} where each citation is a source_file value copied exactly from the sources.'
].join(" ");

function buildUser(question: string, passages: Passage[]): string {
  const lines = passages.map((p, i) => {
    const community = p.communityLabel ? `(${p.communityLabel}) ` : "";
    // Keep source_file= the BARE citable id; location goes elsewhere so the
    // model cites the file (cite-or-refuse keys on source_file, not file:line).
    const loc = p.sourceLocation ? ` [${p.sourceLocation}]` : "";
    const head = `[${i + 1}] source_file=${p.sourceFile} | ${community}${p.label}${loc}`;
    const excerpt = p.text ? `\n    excerpt: ${p.text.replace(/\s+/g, " ").trim().slice(0, 700)}` : "";
    return head + excerpt;
  });
  return `Question: ${question}\n\nSources:\n${lines.join("\n")}`;
}

function parseOutput(text: string): { answer: string; citedSourceFiles: string[] } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { answer: "", citedSourceFiles: [] };
  try {
    const parsed = JSON.parse(match[0]) as { answer?: unknown; citations?: unknown };
    const answer = typeof parsed.answer === "string" ? parsed.answer : "";
    const citations = Array.isArray(parsed.citations) ? parsed.citations.map((c) => String(c)) : [];
    return { answer, citedSourceFiles: citations };
  } catch {
    return { answer: "", citedSourceFiles: [] };
  }
}

export function createGatewaySynthesizer(complete: CompleteFn): Synthesizer {
  return {
    async synthesize({ question, passages }) {
      const result = await complete([
        { role: "system", content: SYSTEM },
        { role: "user", content: buildUser(question, passages) }
      ]);
      if (!result.ok) {
        throw new Error(`ai-gateway synthesis failed: ${result.error.code} (${result.status})`);
      }
      return parseOutput(result.data.text);
    }
  };
}

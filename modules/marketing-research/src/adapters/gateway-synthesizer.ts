import type { Signal, Synthesizer } from "../index";

// Bridges the marketing-research Synthesizer port to the ai-gateway. The module
// stays dep-free: the consumer injects a `complete` closure that captures the
// ai-gateway config/providers/actor/governance, e.g.
//
//   import { complete } from "@microservices-sh/ai-gateway";
//   const synth = createGatewaySynthesizer((messages) =>
//     complete({ messages }, { config, providers, actor, meter, budget, audit }));
//
// The cite-constrained prompt + cite-or-refuse parsing live HERE (the caller),
// not in the gateway. citedSourceUrls is verified against the real signals by
// runResearch (422 MARKETING_UNCITED), so a hallucinated URL cannot ship.
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type CompleteResult = { ok: true; data: { text: string } } | { ok: false; status: number; error: { code: string } };
export type CompleteFn = (messages: ChatMessage[]) => Promise<CompleteResult>;

const SYSTEM = [
  "You are a marketing research analyst.",
  "Write the brief ONLY from the provided community and competitive signals.",
  "Do not use outside knowledge and never invent demand numbers or facts.",
  "Summarize what the signals show, then list concrete, specific marketing implications.",
  "Cite the source_url of EVERY signal you draw any claim from — copy the URL exactly.",
  "If NONE of the signals are relevant to the topic, return an empty summary, empty implications, and an empty citedSourceUrls array.",
  'Respond as strict JSON only: {"summary": string, "implications": string[], "citedSourceUrls": string[]} where each citedSourceUrls value is a source_url copied exactly from the signals.'
].join(" ");

function buildUser(topic: string, signals: Signal[]): string {
  const lines = signals.map((s, i) => {
    const eng = s.engagement !== undefined ? ` (${s.engagement})` : "";
    const excerpt = s.excerpt ? `\n    excerpt: ${s.excerpt.replace(/\s+/g, " ").trim().slice(0, 400)}` : "";
    return `[${i + 1}] source_url=${s.sourceUrl} | ${s.source}${eng} | ${s.title}${excerpt}`;
  });
  return `Topic: ${topic}\n\nSignals:\n${lines.join("\n")}`;
}

function parseOutput(text: string): { summary: string; implications: string[]; citedSourceUrls: string[] } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { summary: "", implications: [], citedSourceUrls: [] };
  try {
    const parsed = JSON.parse(match[0]) as { summary?: unknown; implications?: unknown; citedSourceUrls?: unknown };
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      implications: Array.isArray(parsed.implications) ? parsed.implications.map((x) => String(x)) : [],
      citedSourceUrls: Array.isArray(parsed.citedSourceUrls) ? parsed.citedSourceUrls.map((x) => String(x)) : []
    };
  } catch {
    return { summary: "", implications: [], citedSourceUrls: [] };
  }
}

export function createGatewaySynthesizer(complete: CompleteFn): Synthesizer {
  return {
    async synthesize({ topic, signals }) {
      const result = await complete([
        { role: "system", content: SYSTEM },
        { role: "user", content: buildUser(topic, signals) }
      ]);
      if (!result.ok) {
        throw new Error(`ai-gateway synthesis failed: ${result.error.code} (${result.status})`);
      }
      return parseOutput(result.data.text);
    }
  };
}

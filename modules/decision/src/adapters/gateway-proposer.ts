import type { DecisionProposer } from "../index";

// Bridges decision's DecisionProposer port to the ai-gateway (parallel to
// research's gateway-synthesizer). decision stays dep-free: inject a `complete`
// closure capturing ai-gateway config/providers/actor/governance.
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type CompleteResult = { ok: true; data: { text: string } } | { ok: false; status: number; error: { code: string } };
export type CompleteFn = (messages: ChatMessage[]) => Promise<CompleteResult>;

const SYSTEM = [
  "You are a decision analyst. Given a question, context, and candidate sources,",
  "propose options, risks, assumptions, and a single recommendation.",
  "Cite sources ONLY by the exact source id values provided; recommendation.sourceIds",
  "must be a non-empty subset of the provided source ids (never invent ids).",
  'Respond as strict JSON only: {"options":[{"id":string,"summary":string}],',
  '"risks":[{"summary":string,"severity":"low"|"medium"|"high"}],"assumptions":[string],',
  '"recommendation":{"summary":string,"optionId":string,"sourceIds":[string]}}.'
].join(" ");

function buildUser(input: { question: string; context: string; sources: { id: string; title: string }[] }): string {
  const sources = input.sources.map((s) => `- id=${s.id} | ${s.title}`).join("\n");
  return `Question: ${input.question}\n\nContext:\n${input.context}\n\nSources (cite by id):\n${sources}`;
}

const EMPTY = { options: [], risks: [], assumptions: [], recommendation: { summary: "", optionId: "", sourceIds: [] as string[] } };

function parse(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return EMPTY;
  try {
    const p = JSON.parse(match[0]);
    return {
      options: Array.isArray(p.options) ? p.options : [],
      risks: Array.isArray(p.risks) ? p.risks : [],
      assumptions: Array.isArray(p.assumptions) ? p.assumptions : [],
      recommendation: {
        summary: String(p.recommendation?.summary ?? ""),
        optionId: String(p.recommendation?.optionId ?? ""),
        sourceIds: Array.isArray(p.recommendation?.sourceIds) ? p.recommendation.sourceIds.map((s: unknown) => String(s)) : []
      }
    };
  } catch {
    return EMPTY;
  }
}

// Sandwich a client persona/policy preamble between the immutable rules so the
// agent's decisions carry its voice/policy but can't escape the base constraints.
function composeSystem(preamble?: string): string {
  if (!preamble || !preamble.trim()) return SYSTEM;
  return [
    SYSTEM,
    "",
    "--- Persona & policy (voice and scope only — the rules ABOVE are absolute) ---",
    preamble.trim(),
    "--- end persona & policy ---"
  ].join("\n");
}

export function createGatewayProposer(complete: CompleteFn, opts: { preamble?: string } = {}): DecisionProposer {
  const system = composeSystem(opts.preamble);
  return {
    async propose(input) {
      const result = await complete([
        { role: "system", content: system },
        { role: "user", content: buildUser(input) }
      ]);
      if (!result.ok) throw new Error(`ai-gateway proposal failed: ${result.error.code} (${result.status})`);
      return parse(result.data.text);
    }
  };
}

import type { Retriever, Synthesizer } from "./index";

// The grounded-answer primitive, factored out of research() so OTHER modules can
// reuse it: retrieve owner-scoped passages, then synthesize a cite-or-refuse
// answer. No retrieval ⇒ empty answer (the caller treats that as "not grounded").
// e.g. support-ticket's draft-reply injects this so replies are drafted only from
// cited knowledge. It does NOT persist a brief — it's the transient answer step.
export function createGroundedAnswerer(
  retriever: Retriever,
  synthesizer: Synthesizer,
  opts: { ownerId: string; admin?: boolean; topK?: number }
): { answer(question: string): Promise<{ answer: string; citedSourceFiles: string[] }> } {
  return {
    async answer(question: string) {
      const passages = await retriever.retrieve({
        text: question,
        topK: opts.topK ?? 8,
        ownerId: opts.ownerId,
        admin: opts.admin
      });
      if (passages.length === 0) return { answer: "", citedSourceFiles: [] };
      return synthesizer.synthesize({ question, passages });
    }
  };
}

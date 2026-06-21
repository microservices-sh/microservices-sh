import type { AnswerSynthesizer } from "../ports";

export function createExtractiveSynthesizer(): AnswerSynthesizer {
  return {
    async synthesize(input) {
      const top = input.passages[0];
      if (!top) return { answer: "", citedArticleIds: [] };
      return {
        answer: top.excerpt || top.content.slice(0, 320),
        citedArticleIds: [top.articleId]
      };
    }
  };
}

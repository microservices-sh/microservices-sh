<script lang="ts">
  // Interactive wrapper for the research module. Auto-discovered by the harness
  // (wrappers/<module-id>.svelte). No live backend — the demo mirrors the real
  // GraphRAG contract: retrieve passages over the graph, then synthesize a brief
  // that cites ONLY retrieved sources (cite-or-refuse). A question with no grounded
  // passages is refused with 422 RESEARCH_NO_SOURCES — the module never answers
  // ungrounded.
  import Preview from "@microservices-sh/research/preview";

  let { module: m }: { module: any } = $props();

  const corpus = [
    { sourceFile: "handbook/onboarding.md" },
    { sourceFile: "policies/refunds.md" },
    { sourceFile: "policies/security.md" },
    { sourceFile: "notes/2026-q2-board.md" },
    { sourceFile: "contracts/acme-msa.pdf" }
  ];

  // Scripted retrieval + grounded synthesis per question. The last question has no
  // grounded sources in the corpus → refusal.
  const ANSWERS: Record<string, any> = {
    "What is our refund window?": {
      type: "brief",
      answer: 'Customers may request a refund within <strong>30 days</strong> of purchase; after that, credit-only applies<sup>[1]</sup>. Enterprise contracts can override this via the MSA<sup>[2]</sup>.',
      citations: [{ sourceFile: "policies/refunds.md" }, { sourceFile: "contracts/acme-msa.pdf" }],
      passages: [
        { sourceFile: "policies/refunds.md", snippet: "Refunds are available within 30 days of purchase. Beyond 30 days, account credit is issued instead." },
        { sourceFile: "contracts/acme-msa.pdf", snippet: "§7.2 Refund terms in this MSA supersede the standard policy for the Customer." }
      ]
    },
    "How do we handle security incidents?": {
      type: "brief",
      answer: 'Incidents are triaged within <strong>1 hour</strong>, with customer notification inside 72 hours for any data exposure<sup>[1]</sup>. New hires complete security training during onboarding<sup>[2]</sup>.',
      citations: [{ sourceFile: "policies/security.md" }, { sourceFile: "handbook/onboarding.md" }],
      passages: [
        { sourceFile: "policies/security.md", snippet: "All suspected incidents are triaged within 1 hour; affected customers are notified within 72 hours." },
        { sourceFile: "handbook/onboarding.md", snippet: "Week 1 includes mandatory security-awareness training before production access is granted." }
      ]
    },
    "What did the board decide about pricing?": {
      type: "brief",
      answer: 'The Q2 board endorsed a move to <strong>usage-based pricing</strong> for new logos, keeping legacy seats grandfathered<sup>[1]</sup>.',
      citations: [{ sourceFile: "notes/2026-q2-board.md" }],
      passages: [
        { sourceFile: "notes/2026-q2-board.md", snippet: "Board endorsed usage-based pricing for new customers; existing seat-based plans grandfathered for 12 months." }
      ]
    },
    "What is the CEO's home address?": {
      type: "refused",
      code: "RESEARCH_NO_SOURCES",
      reason: "No passages in the knowledge graph are relevant to this question, so there is nothing to ground an answer on. The module refuses rather than fabricate."
    }
  };

  const questions = Object.keys(ANSWERS);
  let question = $state("");
  let result = $state<any>(null);

  function onask(q: string) {
    question = q;
    result = ANSWERS[q] ?? { type: "refused", code: "RESEARCH_NO_SOURCES", reason: "No grounded sources for this question." };
  }
</script>

<Preview {corpus} {questions} {question} {result} {onask} />

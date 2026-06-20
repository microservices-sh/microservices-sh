<script lang="ts">
  // Interactive wrapper for the decision module. Auto-discovered by the harness
  // (wrappers/<module-id>.svelte). No live backend — the demo mirrors the real
  // flow: a drafted brief (decision.brief_drafted) whose recommendation cites
  // specific sources, then an owner records accept/reject/defer with a rationale
  // (decision.recorded), appended to an immutable log. Status follows the choice.
  import Preview from "@microservices-sh/decision/preview";

  let { module: m }: { module: any } = $props();

  const STATUS_BY_CHOICE: Record<string, string> = { accept: "accepted", reject: "rejected", defer: "deferred" };

  let brief = $state<any>({
    id: "brief_1",
    question: "Should we adopt SvelteKit for the new operator console?",
    context: "The console is internal, data-dense, and maintained by a 2-person team. We need fast iteration and a small bundle.",
    sources: [
      { id: "s1", title: "Team skills audit (internal)", uri: "#" },
      { id: "s2", title: "SvelteKit vs Next bundle benchmark", uri: "#" },
      { id: "s3", title: "Hiring market report 2026", uri: "#" }
    ],
    options: [
      { id: "o1", summary: "Adopt SvelteKit" },
      { id: "o2", summary: "Stay on Next.js" },
      { id: "o3", summary: "Build with plain Vite + Lit" }
    ],
    risks: [
      { summary: "Smaller hiring pool than React", severity: "medium" },
      { summary: "Fewer enterprise component libraries", severity: "low" }
    ],
    assumptions: ["Team stays at 2 engineers for 12 months", "No SSR-heavy public marketing pages in this app"],
    recommendation: { summary: "Adopt SvelteKit — the team already knows Svelte and the bundle wins matter for a data-dense console.", optionId: "o1", sourceIds: ["s1", "s2"] },
    ownerId: "user_grace",
    status: "draft"
  });

  let seq = 1;
  let logs = $state<any[]>([]);

  function ondecide(choice: "accept" | "reject" | "defer", rationale: string) {
    // recordDecision → decision.recorded (append-only; status follows the choice)
    logs = [{ id: `log_${seq++}`, choice, rationale, ownerId: brief.ownerId, decidedAt: new Date().toISOString() }, ...logs];
    brief = { ...brief, status: STATUS_BY_CHOICE[choice] };
  }
</script>

<Preview {brief} {logs} {ondecide} />

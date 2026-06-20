<script lang="ts">
  // Interactive wrapper for the ai-gateway module. Auto-discovered by the harness
  // (wrappers/<module-id>.svelte). No live backend — the demo mirrors the real gate
  // in complete(): authz (403 without ai.invoke) → budget (429 AI_BUDGET_EXCEEDED,
  // checked before any provider cost) → provider resolution (400 if the BYOK key is
  // unset) → meter usage + audit. Toggle scope / key / exhaust the budget to see
  // each fail-closed path.
  import Preview from "@microservices-sh/ai-gateway/preview";

  let { module: m }: { module: any } = $props();

  const provider = "anthropic";
  const model = "claude-opus-4-8";
  const capTokens = 100_000;

  let hasInvokeScope = $state(true);
  let keyConfigured = $state(true);
  let usedTokens = $state(0);
  let calls = $state<any[]>([]);
  let seq = 1;

  function onrun(prompt: string) {
    const now = new Date().toISOString();
    const base = { id: `call_${seq++}`, provider, model, at: now, inputTokens: 0, outputTokens: 0 };
    // Gate runs in order, fail-closed — first failing check wins.
    if (!hasInvokeScope) {
      calls = [{ ...base, status: 403, code: "FORBIDDEN" }, ...calls];
      return;
    }
    if (capTokens - usedTokens <= 0) {
      calls = [{ ...base, status: 429, code: "AI_BUDGET_EXCEEDED" }, ...calls]; // blocked before any provider spend
      return;
    }
    if (!keyConfigured) {
      calls = [{ ...base, status: 400, code: "AI_PROVIDER_NOT_CONFIGURED" }, ...calls];
      return;
    }
    // Allowed: meter token usage (roughly proportional to the prompt) + audit.
    const inputTokens = Math.max(12, Math.round(prompt.length / 4) + 40);
    const outputTokens = 60 + (prompt.length % 50);
    usedTokens = Math.min(capTokens, usedTokens + inputTokens + outputTokens);
    calls = [{ ...base, status: 200, code: null, inputTokens, outputTokens }, ...calls];
  }
  function ontogglescope() { hasInvokeScope = !hasInvokeScope; }
  function ontogglekey() { keyConfigured = !keyConfigured; }
</script>

<Preview
  {provider}
  {model}
  {hasInvokeScope}
  {keyConfigured}
  {usedTokens}
  {capTokens}
  {calls}
  {onrun}
  {ontogglescope}
  {ontogglekey}
/>

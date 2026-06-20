<script lang="ts">
  // Interactive wrapper for the marketing-research module. Auto-discovered by the
  // harness (wrappers/<module-id>.svelte). Owns this module's demo data, live-run
  // handler, and test config (BYOK key) — everything module-specific lives here,
  // so App.svelte stays generic. To make any module interactive, add a wrapper
  // like this + a reference-ui/Preview.svelte; the harness picks both up.
  import { Button } from "@microservices-sh/ui";
  import Preview from "@microservices-sh/marketing-research/preview";

  let { module: m }: { module: any } = $props();

  const DEMO_BRIEF = {
    topic: "Cloudflare Workers",
    summary: "Builders are hand-rolling the 30% (auth, multi-tenant, webhooks); cited 3 signals.",
    implications: ["[reddit] Porting multi-tenant RBAC by hand onto Workers + D1", "[reddit] Protect your project from day 0 (don't expose data)", "[reddit] How are you handling failed webhooks and async tasks?"],
    citations: [
      { sourceUrl: "https://www.reddit.com/r/CloudFlare/comments/multitenant", title: "Porting multi-tenant RBAC by hand onto Workers + D1" },
      { sourceUrl: "https://www.reddit.com/r/Supabase/comments/protect", title: "Protect your project from day 0" },
      { sourceUrl: "https://www.reddit.com/r/SaaS/comments/webhooks", title: "How are you handling failed webhooks and async tasks?" }
    ],
    coverage: { searched: ["reddit", "hackernews"], returned: ["reddit"], note: "hackernews returned 0 (demo)" }
  };
  const DEMO_REFUSED = { code: "MARKETING_NO_SIGNALS", message: "No grounded signals for this topic.", coverage: { searched: ["reddit", "hackernews"], returned: [], note: "all sources returned 0" } };

  let brief = $state<any>(DEMO_BRIEF);
  let refused = $state<any>(null);
  let busy = $state(false);
  let aiKey = $state("");
  let aiModel = $state("deepseek/deepseek-v4-flash");
  let synthMode = $state("");

  async function onrun(topic: string, channels: string[]) {
    busy = true;
    refused = null;
    try {
      const r = await fetch(`/api/${m.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, channels, apiKey: aiKey || undefined, model: aiModel || undefined })
      });
      if (!r.ok) throw new Error("no live backend");
      const out = await r.json();
      brief = out.brief ?? null;
      refused = out.refused ?? null;
      synthMode = out.synthMode ?? "";
    } catch {
      brief = { ...DEMO_BRIEF, topic, summary: `(demo — no live backend) signals for "${topic}".` };
      refused = null;
      synthMode = "demo";
    }
    busy = false;
  }
  function showRefusalDemo() {
    refused = DEMO_REFUSED;
    brief = null;
  }
</script>

<Preview {brief} {refused} {busy} {onrun}>
  {#snippet config()}
    <div class="byok">
      <div class="byok__head">
        <span class="byok__title">Real LLM synthesis</span>
        <span class="byok__req">required for real output — blank runs a stand-in</span>
        {#if synthMode}<span class="byok__mode mono" class:on={synthMode.startsWith("ai-gateway")}>{synthMode}</span>{/if}
      </div>
      <div class="byok__row">
        <label class="byok__f"><span>OpenRouter key</span><input type="password" bind:value={aiKey} placeholder="sk-or-… (BYOK)" autocomplete="off" /></label>
        <label class="byok__f"><span>Model</span><input bind:value={aiModel} placeholder="deepseek/deepseek-v4-flash" /></label>
      </div>
      <div class="byok__foot">
        <p class="byok__note">Local-dev only — sent to the local endpoint, never stored or logged. On Cloudflare this is keyless (Workers AI).</p>
        <Button variant="ghost" size="sm" onclick={showRefusalDemo}>Preview refusal state</Button>
      </div>
    </div>
  {/snippet}
</Preview>

<style>
  .byok { border: 1px solid color-mix(in srgb, var(--color-green) 28%, var(--color-line-strong)); border-radius: 10px; background: color-mix(in srgb, var(--color-green) 5%, var(--color-paper)); padding: 0.8rem 0.95rem; }
  .byok__head { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
  .byok__title { font-weight: 650; font-size: 0.88rem; color: var(--color-ink); }
  .byok__req { font-size: 0.7rem; color: var(--color-amber); }
  .byok__mode { margin-left: auto; font-size: 0.68rem; padding: 0.2rem 0.45rem; border-radius: 6px; background: var(--color-panel); color: var(--color-ink-faint); }
  .byok__mode.on { color: var(--color-green); border: 1px solid color-mix(in srgb, var(--color-green) 40%, transparent); }
  .byok__row { display: flex; flex-wrap: wrap; gap: 0.7rem; margin-top: 0.7rem; }
  .byok__f { display: grid; gap: 0.25rem; flex: 1 1 220px; }
  .byok__f span { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-faint); font-weight: 600; }
  .byok__f input { width: 100%; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.5rem 0.65rem; font: inherit; font-size: 0.85rem; }
  .byok__f input:focus { outline: none; border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }
  .byok__foot { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 0.7rem; flex-wrap: wrap; }
  .byok__note { font-size: 0.7rem; color: var(--color-ink-faint); margin: 0; max-width: 52ch; }
</style>

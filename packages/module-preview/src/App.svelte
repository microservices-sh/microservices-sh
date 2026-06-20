<script lang="ts">
  // Shared design-system tokens — the single source of truth. No hardcoded hex.
  import "@microservices-sh/ui/tokens.css";
  import MarketingResearchPreview from "@microservices-sh/marketing-research/preview";

  // Demo states (real community-listening findings) so previews render without a
  // live engine. Each registered module supplies its Preview + demo data; adding
  // a module here is the whole cost of giving it a standard, DS-consistent preview.
  const DEMO_BRIEF = {
    topic: "Cloudflare Workers",
    summary: "Builders are hand-rolling the 30% (auth, multi-tenant, webhooks); cited 3 signals.",
    implications: [
      "[reddit] Porting multi-tenant RBAC by hand onto Workers + D1",
      "[reddit] Protect your project from day 0 (don't expose data)",
      "[reddit] How are you handling failed webhooks and async tasks?"
    ],
    citations: [
      { sourceUrl: "https://www.reddit.com/r/CloudFlare/comments/multitenant", title: "Porting multi-tenant RBAC by hand onto Workers + D1" },
      { sourceUrl: "https://www.reddit.com/r/Supabase/comments/protect", title: "Protect your project from day 0" },
      { sourceUrl: "https://www.reddit.com/r/SaaS/comments/webhooks", title: "How are you handling failed webhooks and async tasks?" }
    ],
    coverage: { searched: ["reddit", "hackernews"], returned: ["reddit"], note: "hackernews returned 0 (demo)" }
  };
  const DEMO_REFUSED = {
    code: "MARKETING_NO_SIGNALS",
    message: "No grounded signals for this topic.",
    coverage: { searched: ["reddit", "hackernews"], returned: [], note: "all sources returned 0" }
  };

  const MODULES = [{ id: "marketing-research", name: "Marketing Research", Preview: MarketingResearchPreview }];
  let activeId = $state(MODULES[0].id);
  const active = $derived(MODULES.find((m) => m.id === activeId)!);

  let brief = $state<any>(DEMO_BRIEF);
  let refused = $state<any>(null);
  let busy = $state(false);

  // Live: POST to the dev middleware which runs the real module + /last30days.
  // Static build (no backend) falls back to a demo brief.
  async function onrun(topic: string, channels: string[]) {
    busy = true;
    try {
      const r = await fetch("/api/research", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic, channels }) });
      if (!r.ok) throw new Error("no live backend");
      const out = await r.json();
      brief = out.brief ?? null;
      refused = out.refused ?? null;
    } catch {
      brief = { ...DEMO_BRIEF, topic, summary: `(demo — no live backend) signals for "${topic}".` };
      refused = null;
    }
    busy = false;
  }

  function showRefusalDemo() {
    refused = DEMO_REFUSED;
    brief = null;
  }
</script>

<div class="shell">
  <aside>
    <div class="brand">microservices.sh<span> · module preview</span></div>
    <nav>
      {#each MODULES as m}
        <button class:active={m.id === activeId} onclick={() => (activeId = m.id)}>{m.name}</button>
      {/each}
    </nav>
    <div class="states">
      <span class="lbl">demo state</span>
      <button onclick={showRefusalDemo}>Preview refusal</button>
    </div>
    <p class="note">Live in <code>vite dev</code> (real /last30days engine); demo data in the static build. Same Preview component as the template route. DS tokens from @microservices-sh/ui.</p>
  </aside>
  <main>
    {#key activeId}
      {@const Preview = active.Preview}
      <Preview {brief} {refused} {busy} {onrun} />
    {/key}
  </main>
</div>

<style>
  :global(body) { margin: 0; background: var(--color-paper); color: var(--color-ink); font-family: var(--font-sans); }
  .shell { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
  aside { border-right: 1px solid var(--color-line); padding: 1.4rem 1.1rem; background: var(--color-panel-subtle); display: flex; flex-direction: column; gap: 1.1rem; }
  .brand { font-weight: 650; font-size: 0.95rem; }
  .brand span { color: var(--color-ink-faint); font-weight: 400; }
  nav { display: flex; flex-direction: column; gap: 0.3rem; }
  nav button, .states button { text-align: left; background: transparent; border: 1px solid transparent; color: var(--color-ink-soft); padding: 0.45rem 0.6rem; border-radius: 8px; cursor: pointer; font: inherit; }
  nav button.active, .states button.active { background: var(--color-panel); border-color: var(--color-line-strong); color: var(--color-ink); }
  .states { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
  .states .lbl { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-faint); width: 100%; }
  .note { font-size: 0.7rem; color: var(--color-ink-faint); margin-top: auto; line-height: 1.4; }
  main { padding: 2rem 2.4rem; max-width: 860px; }
</style>

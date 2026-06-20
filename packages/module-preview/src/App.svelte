<script lang="ts">
  // Single-module preview — modules are distributed copy-in (a subset per app),
  // so the harness inspects ONE module at a time, chosen via ?module=<id>
  // (default marketing-research). It renders inside the canonical AppShell, as
  // the module would appear installed. Modules override the generic metadata
  // preview by shipping reference-ui/Preview.svelte.
  import { AppShell, Button } from "@microservices-sh/ui";
  import { onMount } from "svelte";
  import GenericPreview from "./GenericPreview.svelte";
  import MarketingResearchPreview from "@microservices-sh/marketing-research/preview";

  const CUSTOM: Record<string, any> = { "marketing-research": MarketingResearchPreview };

  // Lazy: only the selected module's metadata is loaded (not all of them).
  const metaGlob = import.meta.glob("../../../modules/*/module.json");
  const idOf = (p: string) => p.match(/modules\/([^/]+)\//)?.[1] ?? p;
  const ids = Object.keys(metaGlob).map(idOf).sort();

  const targetId = new URLSearchParams(location.search).get("module") ?? "marketing-research";
  let meta = $state<any>(null);

  onMount(async () => {
    const entry = Object.entries(metaGlob).find(([p]) => idOf(p) === targetId);
    if (entry) meta = (await entry[1]()).default;
  });

  function switchModule(e: Event) {
    location.search = `?module=${(e.target as HTMLSelectElement).value}`;
  }

  const nav = $derived(
    meta
      ? [
          {
            section: meta.class ?? "module",
            items: (meta.surfaces?.admin?.nav?.length ? meta.surfaces.admin.nav : [{ label: meta.name }]).map((n: any) => ({ href: `#${meta.id}`, label: n.label }))
          }
        ]
      : []
  );

  // marketing-research live/demo state.
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

  // Module test config (dev only). The BYOK key is a harness/test concern, NOT
  // part of the module's production surface — so it lives here, not in Preview.
  let aiKey = $state("");
  let aiModel = $state("anthropic/claude-3.5-haiku");
  let synthMode = $state<string>("");

  async function onrun(topic: string, channels: string[]) {
    busy = true;
    refused = null;
    try {
      const r = await fetch("/api/research", {
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

{#if meta}
  <AppShell {nav} pathname={`#${meta.id}`} brandHref="#" footer={{ title: meta.name, subtitle: meta.status }} status={`module preview · ${meta.id}`}>
    {#snippet actions()}
      <label class="mp-switch">
        <span>module</span>
        <select onchange={switchModule} value={targetId}>
          {#each ids as id}<option value={id}>{id}</option>{/each}
        </select>
      </label>
      {#if meta.id === "marketing-research"}
        <Button variant="ghost" size="sm" onclick={showRefusalDemo}>Preview refusal</Button>
      {/if}
    {/snippet}

    {#if meta.id === "marketing-research"}
      <details class="mp-config">
        <summary>Test config — real LLM synthesis (BYOK)</summary>
        <div class="mp-config-row">
          <label>OpenRouter key <input type="password" bind:value={aiKey} placeholder="sk-or-… (blank = stand-in)" autocomplete="off" /></label>
          <label>Model <input bind:value={aiModel} placeholder="anthropic/claude-3.5-haiku" /></label>
          {#if synthMode}<span class="mp-mode" class:real={synthMode.startsWith("ai-gateway")}>{synthMode}</span>{/if}
        </div>
        <p class="mp-config-note">Local-dev only — sent to the local preview endpoint, never stored or logged. Blank key → deterministic stand-in. On Cloudflare this is keyless (Workers AI).</p>
      </details>
      <MarketingResearchPreview {brief} {refused} {busy} {onrun} />
    {:else}
      <GenericPreview module={meta} />
    {/if}
  </AppShell>
{/if}

<style>
  .mp-switch { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--color-ink-faint); }
  .mp-switch select { background: var(--color-panel); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 7px; padding: 0.3rem 0.5rem; font: inherit; font-size: 0.8rem; }
  .mp-config { margin: 0 0 1.2rem; border: 1px solid var(--color-line); border-radius: 10px; background: var(--color-panel-subtle); padding: 0.6rem 0.9rem; }
  .mp-config summary { cursor: pointer; font-size: 0.8rem; color: var(--color-ink-soft); }
  .mp-config-row { display: flex; flex-wrap: wrap; gap: 0.8rem; align-items: end; margin-top: 0.7rem; }
  .mp-config label { display: grid; gap: 0.25rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-ink-faint); }
  .mp-config input { background: var(--color-panel); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 7px; padding: 0.4rem 0.6rem; font: inherit; font-size: 0.82rem; min-width: 230px; text-transform: none; letter-spacing: 0; }
  .mp-mode { font-family: var(--font-mono); font-size: 0.72rem; padding: 0.25rem 0.5rem; border-radius: 6px; background: var(--color-panel); color: var(--color-ink-faint); }
  .mp-mode.real { color: var(--color-green); }
  .mp-config-note { font-size: 0.7rem; color: var(--color-ink-faint); margin: 0.6rem 0 0; }
</style>

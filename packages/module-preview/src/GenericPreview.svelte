<script lang="ts">
  // Baseline preview for any module — rendered from its module.json with the
  // shared DS. Modules ship reference-ui/Preview.svelte to override this with a
  // rich, interactive surface (see marketing-research).
  import { Eyebrow, Card, Badge } from "@microservices-sh/ui";

  let { module: m }: { module: any } = $props();

  const rpc = $derived(m?.connections?.rpc?.exposes ?? []);
  const emits = $derived(m?.connections?.events?.emits ?? []);
  const consumes = $derived(m?.connections?.events?.consumes ?? []);
  const requires = $derived(m?.connections?.requires ?? []);
  const optional = $derived(m?.connections?.optional ?? []);
  const adminNav = $derived(m?.surfaces?.admin?.nav ?? []);
  const tools = $derived(m?.surfaces?.agentic?.tools ?? []);
  const approval = $derived(new Set(m?.surfaces?.agentic?.approvalRequiredFor ?? []));
  const tone = $derived(m?.status === "available" ? "success" : "neutral");
</script>

<Eyebrow>{m.class} module · {m.status}</Eyebrow>
<h1 class="gp-h1">{m.name}</h1>
<p class="gp-sum">{m.summary}</p>
<p class="gp-note">Generic preview from <code>module.json</code>. Ship <code>reference-ui/Preview.svelte</code> for a rich interactive surface.</p>

<Card title="Surfaces">
  <p class="gp-lbl">Admin nav</p>
  {#if adminNav.length}
    <ul class="gp-list">{#each adminNav as n}<li><span class="gp-mono">{n.path}</span>{n.label}</li>{/each}</ul>
  {:else}<p class="gp-empty">none declared</p>{/if}

  <p class="gp-lbl">Agentic tools</p>
  {#if tools.length}
    <div class="gp-chips">{#each tools as t}<Badge tone={approval.has(t) ? "warning" : "neutral"}>{t}{approval.has(t) ? " · approval" : ""}</Badge>{/each}</div>
  {:else}<p class="gp-empty">none declared</p>{/if}
</Card>

<Card title="Contract">
  <p class="gp-lbl">RPC</p>
  {#if rpc.length}
    <ul class="gp-list">{#each rpc as r}<li><span class="gp-mono">{r.method}</span><span class="gp-scope">{r.scope}</span></li>{/each}</ul>
  {:else}<p class="gp-empty">none</p>{/if}

  <p class="gp-lbl">Events</p>
  <div class="gp-chips">
    {#each emits as e}<Badge tone="success">↑ {e}</Badge>{/each}
    {#each consumes as c}<Badge tone="neutral">↓ {c}</Badge>{/each}
    {#if !emits.length && !consumes.length}<span class="gp-empty">none</span>{/if}
  </div>

  <p class="gp-lbl">Connections</p>
  <div class="gp-chips">
    {#each requires as d}<Badge tone="neutral">requires {d}</Badge>{/each}
    {#each optional as d}<Badge tone="neutral">optional {d}</Badge>{/each}
    {#if !requires.length && !optional.length}<span class="gp-empty">standalone</span>{/if}
  </div>
</Card>

<Card title="Permissions">
  <div class="gp-chips">
    {#each m?.permissions ?? [] as p}<Badge tone="neutral">{p}</Badge>{/each}
    {#if !(m?.permissions ?? []).length}<span class="gp-empty">none</span>{/if}
  </div>
</Card>

<style>
  .gp-h1 { margin: 0.4rem 0 0.3rem; }
  .gp-sum { color: var(--color-ink-soft); max-width: 62ch; margin: 0 0 0.6rem; }
  .gp-note { font-size: 0.75rem; color: var(--color-ink-faint); margin: 0 0 1.4rem; }
  .gp-note code { font-family: var(--font-mono); color: var(--color-green); }
  .gp-lbl { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-faint); margin: 0.9rem 0 0.35rem; }
  .gp-list { list-style: none; margin: 0; padding: 0; }
  .gp-list li { display: flex; gap: 0.6rem; align-items: baseline; padding: 0.25rem 0; border-bottom: 1px solid var(--color-line); }
  .gp-mono, .gp-scope { font-family: var(--font-mono); font-size: 0.8rem; }
  .gp-scope { color: var(--color-ink-faint); margin-left: auto; }
  .gp-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .gp-empty { color: var(--color-ink-faint); font-size: 0.82rem; }
</style>

<script lang="ts">
  // Baseline preview for any module — rendered from its module.json with the
  // shared DS, matching the marketing-research surface's polish. Modules ship
  // reference-ui/Preview.svelte to override this with a rich interactive surface.
  import { Eyebrow, Badge } from "@microservices-sh/ui";

  let { module: m }: { module: any } = $props();

  const rpc = $derived(m?.connections?.rpc?.exposes ?? []);
  const emits = $derived(m?.connections?.events?.emits ?? []);
  const consumes = $derived(m?.connections?.events?.consumes ?? []);
  const requires = $derived(m?.connections?.requires ?? []);
  const optional = $derived(m?.connections?.optional ?? []);
  const adminNav = $derived(m?.surfaces?.admin?.nav ?? []);
  const tools = $derived(m?.surfaces?.agentic?.tools ?? []);
  const approval = $derived(new Set(m?.surfaces?.agentic?.approvalRequiredFor ?? []));
</script>

<header class="gp-head">
  <Eyebrow>{m.class} module · {m.status}</Eyebrow>
  <h1 class="gp-title">{m.name}</h1>
  <p class="gp-lede">{m.summary}</p>
  <p class="gp-note">Metadata preview — generated from <code>module.json</code>. This module can ship <code>reference-ui/Preview.svelte</code> for a rich, interactive surface (see <strong>marketing-research</strong>).</p>
</header>

<div class="gp-grid">
  <section class="gp-card" style="--i:0">
    <span class="gp-eyebrow mono">surfaces</span>
    <p class="gp-sub">Admin</p>
    {#if adminNav.length}
      <ul class="gp-list">{#each adminNav as n}<li><span class="gp-mono">{n.path}</span>{n.label}</li>{/each}</ul>
    {:else}<p class="gp-empty">no admin nav declared</p>{/if}
    <p class="gp-sub">Agentic tools</p>
    {#if tools.length}
      <div class="gp-chips">{#each tools as t}<Badge tone={approval.has(t) ? "warning" : "neutral"}>{t}{approval.has(t) ? " · approval" : ""}</Badge>{/each}</div>
    {:else}<p class="gp-empty">none</p>{/if}
  </section>

  <section class="gp-card" style="--i:1">
    <span class="gp-eyebrow mono">contract</span>
    <p class="gp-sub">RPC</p>
    {#if rpc.length}
      <ul class="gp-list">{#each rpc as r}<li><span class="gp-mono">{r.method}</span><span class="gp-scope">{r.scope}</span></li>{/each}</ul>
    {:else}<p class="gp-empty">none</p>{/if}
    <p class="gp-sub">Events</p>
    <div class="gp-chips">
      {#each emits as e}<span class="gp-evt gp-evt--up">↑ {e}</span>{/each}
      {#each consumes as c}<span class="gp-evt gp-evt--down">↓ {c}</span>{/each}
      {#if !emits.length && !consumes.length}<span class="gp-empty">none</span>{/if}
    </div>
    <p class="gp-sub">Connections</p>
    <div class="gp-chips">
      {#each requires as d}<Badge tone="neutral">requires {d}</Badge>{/each}
      {#each optional as d}<Badge tone="neutral">optional {d}</Badge>{/each}
      {#if !requires.length && !optional.length}<span class="gp-empty">standalone</span>{/if}
    </div>
  </section>

  <section class="gp-card" style="--i:2">
    <span class="gp-eyebrow mono">permissions</span>
    <div class="gp-chips">
      {#each m?.permissions ?? [] as p}<span class="gp-perm mono">{p}</span>{/each}
      {#if !(m?.permissions ?? []).length}<span class="gp-empty">none</span>{/if}
    </div>
  </section>
</div>

<style>
  .gp-head { margin-bottom: 1.5rem; }
  .gp-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.6rem, 3vw, 2.2rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .gp-lede { color: var(--color-ink-soft); max-width: 64ch; margin: 0 0 0.7rem; font-size: 1rem; }
  .gp-note { font-size: 0.78rem; color: var(--color-ink-faint); margin: 0; max-width: 64ch; }
  .gp-note code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.92em; }
  .gp-note strong { color: var(--color-ink-soft); }

  .gp-grid { display: grid; gap: 0.9rem; }

  /* White "paper" cards — same treatment as the marketing-research brief. */
  .gp-card {
    --p-ink: #1a1f36; --p-soft: #475067; --p-faint: #8a93a3; --p-line: #e6ebf1; --p-green: #0c8f5a; --p-amber: #b45309;
    background: #ffffff; color: var(--p-ink); border: 1px solid var(--p-line); border-radius: 12px; padding: 1rem 1.15rem;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05), 0 16px 32px -20px rgba(16, 24, 40, 0.25);
    animation: gp-rise 0.42s cubic-bezier(0.2, 0.7, 0.2, 1) both; animation-delay: calc(var(--i, 0) * 70ms);
  }
  .gp-eyebrow { display: inline-block; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.09em; color: var(--p-faint); margin-bottom: 0.5rem; }
  .gp-sub { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--p-faint); margin: 0.9rem 0 0.35rem; font-weight: 600; }
  .gp-list { list-style: none; margin: 0; padding: 0; }
  .gp-list li { display: flex; gap: 0.6rem; align-items: baseline; padding: 0.3rem 0; border-bottom: 1px solid var(--p-line); }
  .gp-mono, .gp-scope { font-family: var(--font-mono); font-size: 0.8rem; }
  .gp-mono { color: var(--p-ink); }
  .gp-scope { color: var(--p-faint); margin-left: auto; }
  .gp-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .gp-evt { font-family: var(--font-mono); font-size: 0.72rem; padding: 0.2rem 0.5rem; border-radius: 999px; border: 1px solid var(--p-line); }
  .gp-evt--up { color: var(--p-green); border-color: color-mix(in srgb, var(--p-green) 35%, var(--p-line)); }
  .gp-evt--down { color: var(--p-soft); }
  .gp-perm { font-size: 0.72rem; padding: 0.2rem 0.55rem; border-radius: 6px; background: #f3f5f9; color: var(--p-soft); }
  .gp-empty { color: var(--p-faint); font-size: 0.82rem; }

  @keyframes gp-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .gp-card { animation: none; } }
</style>

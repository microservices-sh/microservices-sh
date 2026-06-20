<!--
  Marketing Research surface, built with the shared design system
  (@microservices-sh/ui). Presentational: the host supplies data + an `onrun`
  handler, so ONE component is reused by both the module-preview harness (demo
  data) and a template route (real server data). No hardcoded colors — the DS
  components carry the tokens.
-->
<script lang="ts">
  import { Eyebrow, Card, Button, Field, Alert, Badge, Loader } from "@microservices-sh/ui";

  type Citation = { sourceUrl: string; title: string };
  type Coverage = { searched: string[]; returned: string[]; note?: string };
  type Brief = { topic: string; summary: string; implications: string[]; citations: Citation[]; coverage: Coverage };
  type Refused = { code: string; message: string; coverage?: Coverage };

  let {
    brief = null,
    refused = null,
    busy = false,
    onrun
  }: { brief?: Brief | null; refused?: Refused | null; busy?: boolean; onrun?: (topic: string, channels: string[]) => void } = $props();

  let topic = $state("Cloudflare Workers");
  let channels = $state("CloudFlare, Supabase");

  const host = (u: string) => {
    try {
      return new URL(u).hostname;
    } catch {
      return u;
    }
  };

  function submit(e: Event) {
    e.preventDefault();
    onrun?.(
      topic.trim(),
      channels.split(",").map((s) => s.trim()).filter(Boolean)
    );
  }
</script>

<Eyebrow>Cited marketing research</Eyebrow>
<h1 class="mr-h1">Marketing Research</h1>
<p class="mr-lede">Pull community and competitive signals into a brief that cites every claim — or refuses when nothing grounds it.</p>

<Card title="Run research">
  <form onsubmit={submit} class="mr-form">
    <Field label="Topic" id="topic">
      <input id="topic" bind:value={topic} placeholder="e.g. Cloudflare Workers" />
    </Field>
    <Field label="Channels (optional, comma-separated)" id="channels">
      <input id="channels" bind:value={channels} placeholder="CloudFlare, Supabase, SaaS" />
    </Field>
    <Button type="submit" variant="primary">{busy ? "Running…" : "Run research"}</Button>
  </form>
</Card>

{#if busy}
  <div class="mr-loading"><Loader size={30} /><span>Running the engine…</span></div>
{:else if refused}
  <Alert tone="error">Refused — {refused.code}: {refused.message}</Alert>
  {#if refused.coverage}
    <p class="mr-cov-line">searched {refused.coverage.searched.join(", ")} · returned {refused.coverage.returned.join(", ") || "none"}</p>
  {/if}
{:else if brief}
  <Card title="Brief">
    <h2 class="mr-summary">{brief.summary}</h2>

    <p class="mr-sub">Implications</p>
    <ul class="mr-impl">
      {#each brief.implications as imp}
        <li>{imp}</li>
      {/each}
    </ul>

    <p class="mr-sub">Citations ({brief.citations.length})</p>
    <ul class="mr-cites">
      {#each brief.citations as c}
        <li>
          <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">
            <span class="mr-src">{host(c.sourceUrl)}</span>{c.title}
          </a>
        </li>
      {/each}
    </ul>

    <div class="mr-cov">
      <Badge tone="neutral">coverage</Badge>
      <span class="mr-cov-text">searched {brief.coverage.searched.join(", ")} · returned {brief.coverage.returned.join(", ") || "none"}</span>
      {#if brief.coverage.note}
        <div class="mr-cov-note">⚠ {brief.coverage.note}</div>
      {/if}
    </div>
  </Card>
{/if}

<style>
  .mr-loading { display: flex; align-items: center; gap: 0.7rem; margin-top: 1.2rem; color: var(--color-ink-soft); font-size: 0.9rem; }
  .mr-h1 { margin: 0.4rem 0 0.3rem; }
  .mr-lede { color: var(--color-ink-soft); max-width: 60ch; margin: 0 0 1.4rem; }
  .mr-form { display: flex; flex-direction: column; gap: 0.85rem; max-width: 460px; }
  .mr-form input { width: 100%; padding: 0.55rem 0.7rem; border-radius: 8px; border: 1px solid var(--color-line-strong); background: var(--color-panel-subtle); color: var(--color-ink); font: inherit; }
  .mr-summary { font-size: 1.05rem; margin: 0 0 0.8rem; }
  .mr-sub { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-faint); margin: 1rem 0 0.35rem; }
  .mr-impl { margin: 0; padding-left: 1.1rem; }
  .mr-impl li { margin: 0.2rem 0; }
  .mr-cites { list-style: none; margin: 0; padding: 0; }
  .mr-cites li { padding: 0.4rem 0; border-bottom: 1px solid var(--color-line); }
  .mr-cites a { color: var(--color-green); text-decoration: none; }
  .mr-cites a:hover { text-decoration: underline; }
  .mr-src { display: block; font-size: 0.7rem; color: var(--color-ink-faint); }
  .mr-cov { margin-top: 1rem; display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; font-size: 0.82rem; }
  .mr-cov-text { color: var(--color-ink-soft); }
  .mr-cov-note { color: var(--color-amber); width: 100%; }
  .mr-cov-line { color: var(--color-amber); font-size: 0.82rem; }
</style>

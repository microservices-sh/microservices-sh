<script lang="ts">
  import { Eyebrow, Card, Button, Field, Alert, Badge } from "$lib/ui";
  import { enhance } from "$app/forms";

  let { form } = $props();
  const host = (u: string) => {
    try {
      return new URL(u).hostname;
    } catch {
      return u;
    }
  };
</script>

<svelte:head><title>Marketing Research · SaaS Starter</title></svelte:head>

<main class="section">
  <Eyebrow>Cited marketing research</Eyebrow>
  <h1>Marketing Research</h1>
  <p class="lede">Pull community and competitive signals into a brief that cites every claim — or refuses when nothing grounds it.</p>

  <Card title="Run research">
    <form method="POST" action="?/run" use:enhance class="mr-form">
      <Field label="Topic" id="topic">
        <input id="topic" name="topic" placeholder="e.g. Cloudflare Workers" value="Cloudflare Workers" required />
      </Field>
      <Field label="Channels (optional, comma-separated)" id="channels">
        <input id="channels" name="channels" placeholder="CloudFlare, Supabase, SaaS" />
      </Field>
      <Button type="submit" variant="primary">Run research</Button>
    </form>
    <p class="hint mono">Demo signals (no live engine or LLM key here). Cite-or-refuse and coverage are real.</p>
  </Card>

  {#if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {:else if form?.refused}
    <Alert tone="error">Refused — {form.refused.code}: {form.refused.message}</Alert>
    {#if form.refused.coverage}
      <p class="cov mono">searched {form.refused.coverage.searched.join(", ")} · returned {form.refused.coverage.returned.join(", ") || "none"}</p>
    {/if}
  {:else if form?.brief}
    <Card title="Brief" class="mt-6">
      <h2 class="brief-summary">{form.brief.summary}</h2>

      <h3 class="brief-h">Implications</h3>
      <ul class="brief-impl">
        {#each form.brief.implications as imp}
          <li>{imp}</li>
        {/each}
      </ul>

      <h3 class="brief-h">Citations ({form.brief.citations.length})</h3>
      <ul class="cites">
        {#each form.brief.citations as c}
          <li>
            <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">
              <span class="mono src">{host(c.sourceUrl)}</span>{c.title}
            </a>
          </li>
        {/each}
      </ul>

      <div class="cov-block">
        <Badge tone="neutral">coverage</Badge>
        <span class="mono">
          searched {form.brief.coverage.searched.join(", ")} · returned {form.brief.coverage.returned.join(", ") || "none"}
        </span>
        {#if form.brief.coverage.note}
          <div class="cov-note mono">⚠ {form.brief.coverage.note}</div>
        {/if}
      </div>
    </Card>
  {/if}
</main>

<style>
  .lede { color: var(--text-muted, #91a89a); max-width: 60ch; margin: 0 0 1.5rem; }
  .mr-form { display: flex; flex-direction: column; gap: 0.9rem; max-width: 460px; }
  .mr-form input { width: 100%; }
  .hint { font-size: 0.72rem; color: var(--text-dim, #5e7568); margin-top: 0.8rem; }
  .brief-summary { font-size: 1.1rem; margin: 0 0 1rem; }
  .brief-h { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim, #5e7568); margin: 1.1rem 0 0.4rem; }
  .brief-impl { margin: 0; padding-left: 1.1rem; }
  .brief-impl li { margin: 0.2rem 0; }
  .cites { list-style: none; margin: 0; padding: 0; }
  .cites li { padding: 0.4rem 0; border-bottom: 1px solid var(--border, #1d2a22); }
  .cites a { color: var(--green, #38ff88); text-decoration: none; }
  .cites a:hover { text-decoration: underline; }
  .src { display: block; font-size: 0.7rem; color: var(--text-dim, #5e7568); }
  .cov-block { margin-top: 1.1rem; display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; font-size: 0.82rem; }
  .cov-note { color: var(--amber, #ffc857); width: 100%; }
  .cov { color: var(--amber, #ffc857); }
</style>

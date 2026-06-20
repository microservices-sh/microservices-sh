<!--
  Marketing Research surface — a "research console" built on the shared design
  system (@microservices-sh/ui). Presentational: the host supplies data + an
  `onrun` handler, and may fill the `config` slot (e.g. a BYOK key for real
  synthesis). One component, reused by the module-preview harness and a template
  route. No hardcoded colours — tokens only.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { Eyebrow, Button, Loader } from "@microservices-sh/ui";

  type Citation = { sourceUrl: string; title: string };
  type Coverage = { searched: string[]; returned: string[]; note?: string };
  type Brief = { topic: string; summary: string; implications: string[]; citations: Citation[]; coverage: Coverage };
  type Refused = { code: string; message: string; coverage?: Coverage };

  let {
    brief = null,
    refused = null,
    busy = false,
    onrun,
    config
  }: { brief?: Brief | null; refused?: Refused | null; busy?: boolean; onrun?: (topic: string, channels: string[]) => void; config?: Snippet } = $props();

  let topic = $state("Cloudflare Workers");
  let channels = $state("CloudFlare, Supabase");

  const host = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return u;
    }
  };

  function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    onrun?.(
      topic.trim(),
      channels.split(",").map((s) => s.trim()).filter(Boolean)
    );
  }
</script>

<header class="rc-head">
  <Eyebrow>Cited marketing research</Eyebrow>
  <h1 class="rc-title">Marketing Research</h1>
  <p class="rc-lede">Turn what people are actually saying online into a marketing brief you can trust — every claim tied to a real source.</p>
  <ol class="rc-how">
    <li><span class="rc-how__n mono">01</span><span><strong>Listen</strong> — pull recent signals from communities (Reddit, Hacker News, GitHub) about a topic.</span></li>
    <li><span class="rc-how__n mono">02</span><span><strong>Synthesize</strong> — write a brief + implications that <strong>cite every claim</strong> to a source, or <strong>refuse</strong> if nothing grounds it (no invented demand).</span></li>
    <li><span class="rc-how__n mono">03</span><span><strong>Report coverage honestly</strong> — you see exactly which sources returned signal and which came back empty.</span></li>
  </ol>
</header>

<section class="rc-console" aria-label="Run research">
  <div class="rc-console__rail" aria-hidden="true"></div>
  <form class="rc-form" onsubmit={submit}>
    <div class="rc-fields">
      <label class="rc-field rc-field--grow">
        <span class="rc-label">Topic</span>
        <input class="rc-input" bind:value={topic} placeholder="e.g. Cloudflare Workers" />
      </label>
      <label class="rc-field">
        <span class="rc-label">Channels <em>optional · subreddits</em></span>
        <input class="rc-input" bind:value={channels} placeholder="CloudFlare, Supabase" />
      </label>
    </div>
    <p class="rc-fieldnote">
      <strong>Channels</strong> = the communities to scope the listening to — comma-separated subreddits (e.g. <code>CloudFlare, Supabase</code>). Leave blank to search broadly across sources.
    </p>

    {#if config}
      <div class="rc-config">{@render config()}</div>
    {/if}

    <div class="rc-actions">
      <Button type="submit" variant="primary">{busy ? "Running…" : "Run research →"}</Button>
      <span class="rc-hint">cite-or-refuse · coverage is reported honestly</span>
    </div>
  </form>
</section>

<div class="rc-out" aria-live="polite">
  {#if busy}
    <div class="rc-busy">
      <Loader size={34} />
      <span>Listening across sources, then synthesizing…</span>
    </div>
  {:else if refused}
    <div class="rc-card rc-card--refused" style="--i:0">
      <div class="rc-refused__code mono">refused · {refused.code}</div>
      <p class="rc-refused__msg">{refused.message}</p>
      {#if refused.coverage}
        <div class="rc-coverage">
          {#each refused.coverage.searched as s}
            <span class="rc-chip" class:rc-chip--on={refused.coverage.returned.includes(s)}>{s}</span>
          {/each}
        </div>
      {/if}
    </div>
  {:else if brief}
    <article class="rc-brief">
      <div class="rc-card" style="--i:0">
        <span class="rc-eyebrow mono">brief</span>
        <p class="rc-summary">{brief.summary}</p>
      </div>

      <div class="rc-card" style="--i:1">
        <span class="rc-eyebrow mono">implications</span>
        <ol class="rc-impl">
          {#each brief.implications as imp}
            <li>{imp}</li>
          {/each}
        </ol>
      </div>

      <div class="rc-card" style="--i:2">
        <span class="rc-eyebrow mono">citations · {brief.citations.length}</span>
        <ul class="rc-cites">
          {#each brief.citations as c}
            <li>
              <a class="rc-cite" href={c.sourceUrl} target="_blank" rel="noopener noreferrer">
                <span class="rc-cite__host mono">{host(c.sourceUrl)}</span>
                <span class="rc-cite__title">{c.title}</span>
                <span class="rc-cite__go" aria-hidden="true">↗</span>
              </a>
            </li>
          {/each}
        </ul>
      </div>

      <div class="rc-card rc-coverage-card" style="--i:3">
        <span class="rc-eyebrow mono">coverage</span>
        <div class="rc-coverage">
          {#each brief.coverage.searched as s}
            <span class="rc-chip" class:rc-chip--on={brief.coverage.returned.includes(s)}>
              <i aria-hidden="true">{brief.coverage.returned.includes(s) ? "●" : "○"}</i>{s}
            </span>
          {/each}
        </div>
        {#if brief.coverage.note}
          <p class="rc-coverage__note">⚠ {brief.coverage.note}</p>
        {/if}
      </div>
    </article>
  {:else}
    <p class="rc-empty">Run the console above to generate a cited brief.</p>
  {/if}
</div>

<style>
  .rc-head { margin-bottom: 1.6rem; }
  .rc-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .rc-lede { color: var(--color-ink-soft); max-width: 56ch; margin: 0; font-size: 1rem; }
  .rc-lede strong { color: var(--color-ink); font-weight: 600; }

  /* ── Run console ── */
  .rc-console { position: relative; border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1.2rem 1.3rem 1.2rem 1.5rem; overflow: hidden; }
  .rc-console__rail { position: absolute; inset: 0 auto 0 0; width: 3px; background: linear-gradient(180deg, var(--color-green), transparent); opacity: 0.7; }
  .rc-fields { display: flex; gap: 0.9rem; flex-wrap: wrap; }
  .rc-field { display: grid; gap: 0.35rem; flex: 1 1 200px; }
  .rc-field--grow { flex: 2 1 280px; }
  .rc-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; }
  .rc-label em { font-style: normal; opacity: 0.6; text-transform: none; letter-spacing: 0; margin-left: 0.3rem; }
  .rc-input { width: 100%; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 9px; padding: 0.6rem 0.75rem; font: inherit; font-size: 0.92rem; transition: border-color 0.15s, box-shadow 0.15s; }
  .rc-input:focus { outline: none; border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 18%, transparent); }
  .rc-config { margin-top: 1rem; }
  .rc-actions { display: flex; align-items: center; gap: 1rem; margin-top: 1.1rem; flex-wrap: wrap; }
  .rc-hint { font-family: var(--font-mono); font-size: 0.7rem; color: var(--color-ink-faint); }

  /* ── Output ── */
  .rc-out { margin-top: 1.6rem; }
  .rc-empty { color: var(--color-ink-faint); font-size: 0.9rem; }
  .rc-busy { display: flex; align-items: center; gap: 0.9rem; color: var(--color-ink-soft); font-size: 0.95rem; padding: 1.4rem 0; }

  .rc-brief { display: grid; gap: 0.9rem; }
  .rc-card { border: 1px solid var(--color-line); border-radius: 12px; background: var(--color-panel-subtle); padding: 1rem 1.15rem; animation: rc-rise 0.42s cubic-bezier(0.2, 0.7, 0.2, 1) both; animation-delay: calc(var(--i, 0) * 70ms); }
  .rc-eyebrow { display: inline-block; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.09em; color: var(--color-ink-faint); margin-bottom: 0.5rem; }
  .rc-summary { font-size: 1.12rem; line-height: 1.5; margin: 0; color: var(--color-ink); }

  .rc-impl { margin: 0; padding: 0; list-style: none; counter-reset: imp; display: grid; gap: 0.5rem; }
  .rc-impl li { counter-increment: imp; position: relative; padding-left: 1.9rem; color: var(--color-ink-soft); }
  .rc-impl li::before { content: counter(imp, decimal-leading-zero); position: absolute; left: 0; top: 0.05rem; font-family: var(--font-mono); font-size: 0.72rem; color: var(--color-green); }

  .rc-cites { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
  .rc-cite { display: grid; grid-template-columns: auto 1fr auto; align-items: baseline; gap: 0.7rem; padding: 0.55rem 0.7rem; border: 1px solid var(--color-line); border-radius: 9px; background: var(--color-paper); text-decoration: none; transition: border-color 0.15s, transform 0.15s, background 0.15s; }
  .rc-cite:hover { border-color: color-mix(in srgb, var(--color-green) 45%, var(--color-line-strong)); transform: translateX(2px); }
  .rc-cite__host { font-size: 0.68rem; color: var(--color-ink-faint); white-space: nowrap; }
  .rc-cite__title { color: var(--color-ink); font-size: 0.9rem; }
  .rc-cite__go { color: var(--color-green); opacity: 0; transition: opacity 0.15s; font-size: 0.85rem; }
  .rc-cite:hover .rc-cite__go { opacity: 1; }

  .rc-coverage { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .rc-chip { display: inline-flex; align-items: center; gap: 0.35rem; font-family: var(--font-mono); font-size: 0.72rem; padding: 0.22rem 0.55rem; border-radius: 999px; border: 1px solid var(--color-line-strong); color: var(--color-ink-faint); }
  .rc-chip i { font-size: 0.6rem; font-style: normal; }
  .rc-chip--on { color: var(--color-green); border-color: color-mix(in srgb, var(--color-green) 40%, var(--color-line-strong)); }
  .rc-coverage__note { color: var(--color-amber); font-size: 0.8rem; margin: 0.7rem 0 0; }

  .rc-card--refused { border-color: color-mix(in srgb, var(--color-amber) 50%, var(--color-line-strong)); background: color-mix(in srgb, var(--color-amber) 7%, var(--color-panel-subtle)); }
  .rc-refused__code { font-size: 0.72rem; color: var(--color-amber); text-transform: uppercase; letter-spacing: 0.06em; }
  .rc-refused__msg { margin: 0.4rem 0 0.8rem; color: var(--color-ink); }

  @keyframes rc-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .rc-card { animation: none; } }

  /* ── How it works ── */
  .rc-how { list-style: none; margin: 1rem 0 0; padding: 0; display: grid; gap: 0.5rem; max-width: 64ch; }
  .rc-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .rc-how strong { color: var(--color-ink); font-weight: 600; }
  .rc-how__n { color: var(--color-green); font-size: 0.72rem; }
  .rc-fieldnote { margin: 0.8rem 0 0; font-size: 0.78rem; color: var(--color-ink-faint); max-width: 62ch; }
  .rc-fieldnote strong { color: var(--color-ink-soft); }
  .rc-fieldnote code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.92em; }

  /* ── White "paper" result cards (fixed light palette so the brief reads as a
     clean report regardless of the shell theme) ── */
  .rc-brief, .rc-card--refused {
    --p-ink: #1a1f36; --p-soft: #475067; --p-faint: #8a93a3;
    --p-line: #e6ebf1; --p-green: #0c8f5a; --p-amber: #b45309;
  }
  .rc-card { background: #ffffff; color: var(--p-ink); border-color: var(--p-line); box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05), 0 16px 32px -20px rgba(16, 24, 40, 0.25); }
  .rc-eyebrow { color: var(--p-faint); }
  .rc-summary { color: var(--p-ink); }
  .rc-impl li { color: var(--p-soft); }
  .rc-impl li::before { color: var(--p-green); }
  .rc-cite { background: #fbfcfe; border-color: var(--p-line); }
  .rc-cite:hover { border-color: color-mix(in srgb, var(--p-green) 50%, var(--p-line)); background: #ffffff; }
  .rc-cite__host { color: var(--p-faint); }
  .rc-cite__title { color: var(--p-ink); }
  .rc-cite__go { color: var(--p-green); }
  .rc-chip { color: var(--p-faint); border-color: var(--p-line); }
  .rc-chip--on { color: var(--p-green); border-color: color-mix(in srgb, var(--p-green) 40%, var(--p-line)); }
  .rc-coverage__note { color: var(--p-amber); }
  .rc-card--refused { background: #fffbeb; border-color: #f3d59a; }
  .rc-refused__code { color: var(--p-amber); }
  .rc-refused__msg { color: var(--p-ink); }
</style>

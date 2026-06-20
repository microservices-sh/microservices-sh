<!--
  Research surface — explains and demonstrates what the module does (GraphRAG: turn
  company files into a knowledge graph, retrieve over it, and synthesize a CITED
  brief — cite-or-refuse). Built on the shared DS; corpus + per-question result are
  host-supplied. The point shown here: the module never answers ungrounded — a
  question with no retrieved passages is REFUSED (422), and a synthesized answer may
  cite only sources that were actually retrieved. Reused by the harness & templates.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type Source = { sourceFile: string };
  type Passage = { sourceFile: string; snippet: string };
  type Result =
    | { type: "brief"; answer: string; citations: { sourceFile: string }[]; passages: Passage[] }
    | { type: "refused"; code: string; reason: string }
    | null;

  let {
    corpus = [],
    questions = [],
    question = "",
    result = null,
    busy = false,
    onask
  }: {
    corpus?: Source[];
    questions?: string[];
    question?: string;
    result?: Result;
    busy?: boolean;
    onask?: (question: string) => void;
  } = $props();

  // Map a cited source file to its 1-based index for [n] markers.
  const citeIndex = (file: string): number => {
    if (result?.type !== "brief") return 0;
    return result.citations.findIndex((c) => c.sourceFile === file) + 1;
  };
</script>

<header class="rs-head">
  <Eyebrow>Research · GraphRAG</Eyebrow>
  <h1 class="rs-title">Research</h1>
  <p class="rs-lede">Turn company files into a <strong>knowledge graph</strong>, retrieve over it, and synthesize a <strong>cited brief</strong> — <strong>cite-or-refuse</strong>. The module never answers ungrounded: a question with no retrieved sources is refused, and an answer may cite only what was actually retrieved.</p>
  <ol class="rs-how">
    <li><span class="rs-how__n mono">01</span><span><strong>Ingest</strong> — files become a graph via graphify (batch), loaded into a GraphStore.</span></li>
    <li><span class="rs-how__n mono">02</span><span><strong>Retrieve</strong> — pull the passages relevant to the question from the graph.</span></li>
    <li><span class="rs-how__n mono">03</span><span><strong>Synthesize</strong> — answer citing only retrieved sources; no sources → <code>refuse (422)</code>.</span></li>
  </ol>
</header>

<section class="rs-corpus" aria-label="Knowledge graph corpus">
  <p class="rs-label">Knowledge graph <span class="mono">({corpus.length} sources)</span></p>
  <ul class="rs-files">
    {#each corpus as c}
      <li class="rs-file"><span class="rs-file__ico" aria-hidden="true">📄</span><span class="mono">{c.sourceFile}</span></li>
    {/each}
  </ul>
</section>

<section class="rs-ask" aria-label="Ask a question">
  <div class="rs-ask__rail" aria-hidden="true"></div>
  <p class="rs-label">Ask the graph</p>
  <div class="rs-qs">
    {#each questions as q}
      <button type="button" class="rs-q" class:on={q === question} disabled={busy} onclick={() => onask?.(q)}>{q}</button>
    {/each}
  </div>
</section>

{#if result}
  {#if result.type === "brief"}
    <div class="rs-brief">
      <p class="rs-q-echo">{question}</p>
      <p class="rs-answer">{@html result.answer}</p>

      <p class="rs-sublabel">Citations</p>
      <ol class="rs-cites">
        {#each result.citations as c, i}
          <li><span class="rs-cite__n mono">[{i + 1}]</span><span class="mono">{c.sourceFile}</span></li>
        {/each}
      </ol>

      <p class="rs-sublabel">Retrieved passages</p>
      <ul class="rs-passages">
        {#each result.passages as p}
          <li class="rs-passage">
            <span class="rs-passage__src mono">{p.sourceFile}{#if citeIndex(p.sourceFile)}<span class="rs-passage__cited"> · cited [{citeIndex(p.sourceFile)}]</span>{/if}</span>
            <span class="rs-passage__txt">{p.snippet}</span>
          </li>
        {/each}
      </ul>
    </div>
  {:else}
    <div class="rs-refused">
      <span class="rs-refused__ico" aria-hidden="true">⊘</span>
      <div>
        <p class="rs-refused__h">Refused · <span class="mono">{result.code}</span> (422)</p>
        <p class="rs-refused__txt">{result.reason}</p>
      </div>
    </div>
  {/if}
{:else}
  <p class="rs-empty">Pick a question to retrieve and synthesize a brief.</p>
{/if}

<style>
  .rs-head { margin-bottom: 1.5rem; }
  .rs-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .rs-lede { color: var(--color-ink-soft); max-width: 68ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .rs-lede strong { color: var(--color-ink); font-weight: 600; }
  .rs-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .rs-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 76ch; }
  .rs-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .rs-how strong { color: var(--color-ink); font-weight: 600; }
  .rs-how__n { color: var(--color-green); font-size: 0.72rem; }

  .rs-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; margin: 0 0 0.6rem; }
  .rs-corpus { margin-bottom: 1rem; }
  .rs-files { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .rs-file { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 8px; padding: 0.3rem 0.55rem; color: var(--color-ink-soft); }
  .rs-file__ico { font-size: 0.8rem; }

  .rs-ask { position: relative; border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1rem 1.1rem 1.1rem 1.3rem; overflow: hidden; margin-bottom: 1rem; }
  .rs-ask__rail { position: absolute; inset: 0 auto 0 0; width: 3px; background: linear-gradient(180deg, var(--color-green), transparent); opacity: 0.7; }
  .rs-qs { display: grid; gap: 0.4rem; }
  .rs-q { text-align: left; font: inherit; font-size: 0.86rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 9px; padding: 0.55rem 0.7rem; cursor: pointer; transition: border-color 0.15s; }
  .rs-q:hover:not(:disabled) { border-color: var(--color-green); }
  .rs-q.on { border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 14%, transparent); }
  .rs-q:disabled { opacity: 0.6; cursor: default; }

  .rs-empty { color: var(--color-ink-faint); font-size: 0.85rem; }

  .rs-brief { border: 1px solid var(--color-line-strong); border-radius: 14px; background: var(--color-paper); padding: 1.1rem 1.2rem; }
  .rs-q-echo { font-weight: 700; font-size: 1rem; margin: 0 0 0.6rem; }
  .rs-answer { font-size: 0.92rem; line-height: 1.55; color: var(--color-ink); margin: 0 0 1rem; }
  .rs-answer :global(sup) { color: var(--color-green); font-weight: 700; font-family: var(--font-mono); font-size: 0.7em; padding: 0 0.1em; }
  .rs-sublabel { font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-faint); font-weight: 600; margin: 0.9rem 0 0.4rem; }
  .rs-cites { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.25rem; }
  .rs-cites li { display: flex; gap: 0.5rem; font-size: 0.8rem; color: var(--color-ink-soft); }
  .rs-cite__n { color: var(--color-green); }
  .rs-passages { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
  .rs-passage { border: 1px solid var(--color-line-strong); border-radius: 9px; padding: 0.5rem 0.65rem; background: var(--color-panel-subtle); display: grid; gap: 0.15rem; }
  .rs-passage__src { font-size: 0.7rem; color: var(--color-ink-faint); }
  .rs-passage__cited { color: var(--color-green); }
  .rs-passage__txt { font-size: 0.82rem; color: var(--color-ink-soft); }

  .rs-refused { display: flex; align-items: flex-start; gap: 0.8rem; border: 1px solid color-mix(in srgb, #ef4444 32%, transparent); background: color-mix(in srgb, #ef4444 7%, transparent); border-radius: 14px; padding: 1.1rem 1.2rem; }
  .rs-refused__ico { font-size: 1.6rem; color: #ef4444; line-height: 1; flex: none; }
  .rs-refused__h { margin: 0 0 0.25rem; font-weight: 700; font-size: 0.95rem; color: var(--color-ink); }
  .rs-refused__txt { margin: 0; font-size: 0.86rem; color: var(--color-ink-soft); }
</style>

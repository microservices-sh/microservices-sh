<!--
  Decision surface — explains and demonstrates what the module does (a cited,
  human-owned decision brief that closes into action and an append-only log). Built
  on the shared DS; the brief + log + handler are host-supplied. The point shown
  here: the recommendation CITES specific sources (no uncited claims), and a human
  owner — not the model — accepts/rejects/defers with a rationale that is appended
  to an immutable log. Reused by the harness and template routes.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type SourceRef = { id: string; title: string; uri: string };
  type Option = { id: string; summary: string };
  type Risk = { summary: string; severity: "low" | "medium" | "high" };
  type Recommendation = { summary: string; optionId: string; sourceIds: string[] };
  type Status = "draft" | "accepted" | "rejected" | "deferred";
  type Brief = { id: string; question: string; context: string; sources: SourceRef[]; options: Option[]; risks: Risk[]; assumptions: string[]; recommendation: Recommendation; ownerId: string; status: Status };
  type Choice = "accept" | "reject" | "defer";
  type Log = { id: string; choice: Choice; rationale: string; ownerId: string; decidedAt: string };

  let {
    brief,
    logs = [],
    busy = false,
    ondecide
  }: {
    brief: Brief;
    logs?: Log[];
    busy?: boolean;
    ondecide?: (choice: Choice, rationale: string) => void;
  } = $props();

  let rationale = $state("");
  let hovered = $state<string | null>(null); // hovered source id, to highlight citations

  const STATUS_TINT: Record<Status, string> = { draft: "#94a3b8", accepted: "#0c8f5a", rejected: "#ef4444", deferred: "#f59e0b" };
  const SEV_TINT = { low: "#94a3b8", medium: "#f59e0b", high: "#ef4444" };
  const cited = $derived(new Set(brief?.recommendation.sourceIds ?? []));
  const recommendedOption = $derived(brief?.options.find((o) => o.id === brief.recommendation.optionId) ?? null);
  const when = (iso: string) => new Date(iso).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  function decide(choice: Choice) {
    ondecide?.(choice, rationale.trim() || "(no rationale given)");
    rationale = "";
  }
</script>

<header class="de-head">
  <Eyebrow>Decision · advise</Eyebrow>
  <h1 class="de-title">Decision</h1>
  <p class="de-lede">A <strong>cited, human-owned</strong> decision brief: the recommendation must <strong>point to specific sources</strong> — no uncited claims — and a person, not the model, accepts/rejects/defers. Every choice is appended to an <strong>immutable decision log</strong>.</p>
  <ol class="de-how">
    <li><span class="de-how__n mono">01</span><span><strong>Draft</strong> — question, options, risks and a recommendation that cites its sources; emits <code>decision.brief_drafted</code>.</span></li>
    <li><span class="de-how__n mono">02</span><span><strong>Decide</strong> — the owner accepts, rejects or defers with a rationale.</span></li>
    <li><span class="de-how__n mono">03</span><span><strong>Log</strong> — the choice is appended, never overwritten; emits <code>decision.recorded</code>.</span></li>
  </ol>
</header>

{#if brief}
  <section class="de-brief" aria-label="Decision brief">
    <div class="de-brief__rail" aria-hidden="true"></div>
    <div class="de-brief__top">
      <p class="de-q">{brief.question}</p>
      <span class="de-status" style={`--tint:${STATUS_TINT[brief.status]}`}>{brief.status}</span>
    </div>
    <p class="de-ctx">{brief.context}</p>

    <p class="de-label">Recommendation</p>
    <div class="de-rec">
      <p class="de-rec__sum">{brief.recommendation.summary}</p>
      {#if recommendedOption}<p class="de-rec__opt mono">→ {recommendedOption.summary}</p>{/if}
      <p class="de-rec__cites">
        cites:
        {#each brief.recommendation.sourceIds as sid}
          {@const src = brief.sources.find((s) => s.id === sid)}
          <a class="de-cite" href={src?.uri} target="_blank" rel="noopener" onmouseenter={() => (hovered = sid)} onmouseleave={() => (hovered = null)}>{src?.title ?? sid}</a>
        {/each}
      </p>
    </div>

    <div class="de-cols">
      <div class="de-col">
        <p class="de-label">Options</p>
        <ul class="de-list">
          {#each brief.options as o}
            <li class:rec={o.id === brief.recommendation.optionId}>{o.summary}{#if o.id === brief.recommendation.optionId}<span class="de-tag mono">recommended</span>{/if}</li>
          {/each}
        </ul>
      </div>
      <div class="de-col">
        <p class="de-label">Risks</p>
        <ul class="de-list">
          {#each brief.risks as r}
            <li><span class="de-sev" style={`--tint:${SEV_TINT[r.severity]}`}>{r.severity}</span>{r.summary}</li>
          {/each}
        </ul>
      </div>
    </div>

    <p class="de-label">Sources</p>
    <ul class="de-sources">
      {#each brief.sources as s}
        <li class="de-src" class:cited={cited.has(s.id)} class:hot={hovered === s.id}>
          <span class="de-src__id mono">{s.id}</span>
          <a class="de-src__title" href={s.uri} target="_blank" rel="noopener">{s.title}</a>
          {#if cited.has(s.id)}<span class="de-src__badge mono">cited</span>{/if}
        </li>
      {/each}
    </ul>
  </section>

  <section class="de-decide" aria-label="Record a decision">
    <p class="de-label">Owner decision <em>· {brief.ownerId}</em></p>
    <textarea class="de-rationale" bind:value={rationale} rows="2" placeholder="Rationale (recorded with the choice)…"></textarea>
    <div class="de-choices">
      <Button variant="primary" disabled={busy} onclick={() => decide("accept")}>Accept</Button>
      <button type="button" class="de-btn de-btn--reject" disabled={busy} onclick={() => decide("reject")}>Reject</button>
      <button type="button" class="de-btn de-btn--defer" disabled={busy} onclick={() => decide("defer")}>Defer</button>
    </div>
  </section>

  <div class="de-out">
    <p class="de-out__h mono">Decision log <span>({logs.length})</span> · append-only</p>
    {#if logs.length}
      <ul class="de-log">
        {#each logs as l (l.id)}
          <li class="de-logrow">
            <span class="de-logrow__choice de-logrow__choice--{l.choice}">{l.choice}</span>
            <span class="de-logrow__rat">{l.rationale}</span>
            <span class="de-logrow__meta mono">{l.ownerId} · {when(l.decidedAt)}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="de-empty">Record a decision to append the first log entry.</p>
    {/if}
  </div>
{/if}

<style>
  .de-head { margin-bottom: 1.5rem; }
  .de-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .de-lede { color: var(--color-ink-soft); max-width: 66ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .de-lede strong { color: var(--color-ink); font-weight: 600; }
  .de-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 74ch; }
  .de-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .de-how strong { color: var(--color-ink); font-weight: 600; }
  .de-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .de-how__n { color: var(--color-green); font-size: 0.72rem; }

  .de-brief { position: relative; border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1.1rem 1.2rem 1.2rem 1.4rem; overflow: hidden; margin-bottom: 1rem; }
  .de-brief__rail { position: absolute; inset: 0 auto 0 0; width: 3px; background: linear-gradient(180deg, var(--color-green), transparent); opacity: 0.7; }
  .de-brief__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
  .de-q { font-weight: 700; font-size: 1.05rem; margin: 0; }
  .de-status { font-family: var(--font-mono); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.22rem 0.55rem; border-radius: 999px; color: var(--tint); background: color-mix(in srgb, var(--tint) 15%, transparent); border: 1px solid color-mix(in srgb, var(--tint) 32%, transparent); flex: none; }
  .de-ctx { color: var(--color-ink-soft); font-size: 0.88rem; margin: 0.4rem 0 0.9rem; }
  .de-label { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-faint); font-weight: 600; margin: 0.9rem 0 0.4rem; }
  .de-label em { font-style: normal; opacity: 0.7; text-transform: none; letter-spacing: 0; }

  .de-rec { border: 1px solid color-mix(in srgb, var(--color-green) 28%, var(--color-line-strong)); background: color-mix(in srgb, var(--color-green) 5%, transparent); border-radius: 10px; padding: 0.7rem 0.85rem; }
  .de-rec__sum { margin: 0; font-weight: 600; font-size: 0.92rem; }
  .de-rec__opt { margin: 0.25rem 0 0; font-size: 0.8rem; color: var(--color-ink-soft); }
  .de-rec__cites { margin: 0.5rem 0 0; font-size: 0.72rem; color: var(--color-ink-faint); display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: baseline; }
  .de-cite { font-family: var(--font-mono); font-size: 0.72rem; color: var(--color-green); text-decoration: none; border-bottom: 1px dotted color-mix(in srgb, var(--color-green) 50%, transparent); }
  .de-cite:hover { border-bottom-style: solid; }

  .de-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 640px) { .de-cols { grid-template-columns: 1fr; } }
  .de-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
  .de-list li { font-size: 0.85rem; color: var(--color-ink-soft); display: flex; gap: 0.45rem; align-items: baseline; }
  .de-list li.rec { color: var(--color-ink); font-weight: 500; }
  .de-tag { font-size: 0.62rem; color: var(--color-green); text-transform: uppercase; letter-spacing: 0.04em; }
  .de-sev { font-family: var(--font-mono); font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tint); border: 1px solid color-mix(in srgb, var(--tint) 40%, transparent); border-radius: 4px; padding: 0.05rem 0.3rem; flex: none; }

  .de-sources { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
  .de-src { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.6rem; font-size: 0.82rem; padding: 0.4rem 0.55rem; border: 1px solid var(--color-line-strong); border-radius: 8px; background: var(--color-paper); transition: border-color 0.15s, background 0.15s; }
  .de-src.cited { border-color: color-mix(in srgb, var(--color-green) 30%, var(--color-line-strong)); }
  .de-src.hot { border-color: var(--color-green); background: color-mix(in srgb, var(--color-green) 7%, var(--color-paper)); }
  .de-src__id { font-size: 0.68rem; color: var(--color-ink-faint); }
  .de-src__title { color: var(--color-ink); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .de-src__title:hover { text-decoration: underline; }
  .de-src__badge { font-size: 0.62rem; color: var(--color-green); text-transform: uppercase; }

  .de-decide { border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1rem 1.1rem; margin-bottom: 1.4rem; }
  .de-rationale { width: 100%; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.55rem 0.7rem; font: inherit; font-size: 0.88rem; resize: vertical; margin-bottom: 0.7rem; }
  .de-rationale:focus { outline: none; border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }
  .de-choices { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .de-btn { font: inherit; font-size: 0.85rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink-soft); border-radius: 9px; padding: 0.5rem 0.9rem; cursor: pointer; }
  .de-btn--reject:hover:not(:disabled) { border-color: #e9b8b8; color: #9b2c2c; }
  .de-btn--defer:hover:not(:disabled) { border-color: color-mix(in srgb, #f59e0b 45%, var(--color-line-strong)); color: #b45309; }

  .de-out__h { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-ink-faint); margin: 0 0 0.6rem; }
  .de-empty { color: var(--color-ink-faint); font-size: 0.85rem; }
  .de-log { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
  .de-logrow { display: grid; grid-template-columns: auto 1fr auto; align-items: baseline; gap: 0.7rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 9px; padding: 0.5rem 0.7rem; }
  .de-logrow__choice { font-family: var(--font-mono); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.15rem 0.45rem; border-radius: 999px; flex: none; }
  .de-logrow__choice--accept { color: #0c8f5a; background: #d8f6e8; }
  .de-logrow__choice--reject { color: #9b2c2c; background: #fde8e8; }
  .de-logrow__choice--defer { color: #b45309; background: #fdecc8; }
  .de-logrow__rat { font-size: 0.84rem; color: var(--color-ink-soft); min-width: 0; }
  .de-logrow__meta { font-size: 0.7rem; color: var(--color-ink-faint); white-space: nowrap; }
</style>

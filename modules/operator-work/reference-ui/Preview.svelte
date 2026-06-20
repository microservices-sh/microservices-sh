<!--
  Operator Work surface — explains and demonstrates what the module does (an
  agent-readable operator workbench: a task board, a focus plan, and a daily review,
  all as auditable operator state). Built on the shared DS; tasks/focus/review +
  handlers are host-supplied. The point shown here: tasks carry a SOURCE (manual /
  agent / calendar / inbox) so human and agent work share one board, and every move
  is an emitted, auditable event. Reused by the harness and template routes.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type Status = "todo" | "in-progress" | "done";
  type Priority = "High" | "Medium" | "Low";
  type Source = "manual" | "agent" | "calendar" | "inbox";
  type Energy = "Deep" | "Review" | "Comms" | "Admin" | "Close";
  type Task = { id: string; title: string; detail: string; status: Status; priority: Priority; category: string; dueLabel: string; source: Source; subtasks: { id: string; done: boolean }[] };
  type FocusBlock = { id: string; timeRange: string; title: string; energy: Energy; note: string };
  type Review = { shipped: string; openLoops: string; agentHandoffs: string; tomorrowFirstMove: string; status: "draft" | "saved" } | null;

  let {
    tasks = [],
    focusBlocks = [],
    review = null,
    busy = false,
    ontaskstatus,
    onsavereview
  }: {
    tasks?: Task[];
    focusBlocks?: FocusBlock[];
    review?: Review;
    busy?: boolean;
    ontaskstatus?: (id: string, status: Status) => void;
    onsavereview?: (input: { shipped: string; openLoops: string; agentHandoffs: string; tomorrowFirstMove: string }) => void;
  } = $props();

  const COLUMNS: { key: Status; label: string }[] = [
    { key: "todo", label: "To do" },
    { key: "in-progress", label: "In progress" },
    { key: "done", label: "Done" }
  ];
  const PRIO_TINT: Record<Priority, string> = { High: "#ef4444", Medium: "#f59e0b", Low: "#94a3b8" };
  const ENERGY_TINT: Record<Energy, string> = { Deep: "#6366f1", Review: "#0c8f5a", Comms: "#3b82f6", Admin: "#94a3b8", Close: "#8b5cf6" };
  const SOURCE_ICON: Record<Source, string> = { manual: "✍️", agent: "🤖", calendar: "📅", inbox: "📥" };

  const openCount = $derived(tasks.filter((t) => t.status !== "done").length);
  const highCount = $derived(tasks.filter((t) => t.status !== "done" && t.priority === "High").length);
  const agentCount = $derived(tasks.filter((t) => t.source === "agent").length);
  const byCol = (s: Status) => tasks.filter((t) => t.status === s);
  const nextStatus = (s: Status): Status => (s === "todo" ? "in-progress" : "done");
  const prevStatus = (s: Status): Status => (s === "done" ? "in-progress" : "todo");

  // Daily review form (the editable surface; `review` reflects the saved result).
  let shipped = $state("");
  let openLoops = $state("");
  let agentHandoffs = $state("");
  let tomorrowFirstMove = $state("");
  let savedNote = $state(false);

  // Seed the form from an existing review once, when one is supplied.
  let seeded = false;
  $effect(() => {
    if (!seeded && review) {
      shipped = review.shipped; openLoops = review.openLoops; agentHandoffs = review.agentHandoffs; tomorrowFirstMove = review.tomorrowFirstMove;
      seeded = true;
    }
  });

  function saveReview(e: Event) {
    e.preventDefault();
    onsavereview?.({ shipped, openLoops, agentHandoffs, tomorrowFirstMove });
    savedNote = true;
  }
</script>

<header class="ow-head">
  <Eyebrow>Operator work</Eyebrow>
  <h1 class="ow-title">Operator Work</h1>
  <p class="ow-lede">An <strong>agent-readable operator workbench</strong>: a task board where human and agent work share one surface (each task has a <strong>source</strong>), a focus plan, and a daily review — all kept as <strong>auditable operator state</strong> that emits an event on every move.</p>
  <ol class="ow-how">
    <li><span class="ow-how__n mono">01</span><span><strong>Board</strong> — upsert tasks and advance status; emits <code>task.upserted</code> / <code>task.status_changed</code>.</span></li>
    <li><span class="ow-how__n mono">02</span><span><strong>Focus plan</strong> — time-boxed blocks tagged by energy; emits <code>focus_block.upserted</code>.</span></li>
    <li><span class="ow-how__n mono">03</span><span><strong>Daily review</strong> — shipped, open loops, handoffs, first move; emits <code>daily_review.saved</code>.</span></li>
  </ol>
</header>

<section class="ow-summary" aria-label="Workbench summary">
  <span class="ow-stat"><span class="ow-stat__n">{openCount}</span><span class="ow-stat__k">open</span></span>
  <span class="ow-stat"><span class="ow-stat__n" style="color:#ef4444">{highCount}</span><span class="ow-stat__k">high priority</span></span>
  <span class="ow-stat"><span class="ow-stat__n">{focusBlocks.length}</span><span class="ow-stat__k">focus blocks</span></span>
  <span class="ow-stat"><span class="ow-stat__n" style="color:var(--color-green)">{agentCount}</span><span class="ow-stat__k">🤖 agent tasks</span></span>
</section>

<section class="ow-board" aria-label="Task board">
  {#each COLUMNS as col}
    <div class="ow-col">
      <p class="ow-col__h">{col.label} <span class="mono">{byCol(col.key).length}</span></p>
      <ul class="ow-cards">
        {#each byCol(col.key) as t (t.id)}
          <li class="ow-card">
            <div class="ow-card__top">
              <span class="ow-prio" style={`--tint:${PRIO_TINT[t.priority]}`} title={`${t.priority} priority`}></span>
              <span class="ow-card__title">{t.title}</span>
              <span class="ow-src" title={`source: ${t.source}`}>{SOURCE_ICON[t.source]}</span>
            </div>
            {#if t.detail}<p class="ow-card__detail">{t.detail}</p>{/if}
            <div class="ow-card__foot">
              <span class="ow-card__meta mono">{t.category} · {t.dueLabel}{#if t.subtasks.length} · {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}{/if}</span>
              <span class="ow-card__nav">
                {#if t.status !== "todo"}<button type="button" class="ow-mv" disabled={busy} aria-label="Move back" onclick={() => ontaskstatus?.(t.id, prevStatus(t.status))}>←</button>{/if}
                {#if t.status !== "done"}<button type="button" class="ow-mv" disabled={busy} aria-label="Move forward" onclick={() => ontaskstatus?.(t.id, nextStatus(t.status))}>→</button>{/if}
              </span>
            </div>
          </li>
        {:else}
          <li class="ow-empty">—</li>
        {/each}
      </ul>
    </div>
  {/each}
</section>

<section class="ow-grid">
  <div class="ow-panel">
    <p class="ow-label">Focus plan · today</p>
    {#if focusBlocks.length}
      <ul class="ow-focus">
        {#each focusBlocks as f (f.id)}
          <li class="ow-fb">
            <span class="ow-fb__time mono">{f.timeRange}</span>
            <span class="ow-fb__main">
              <span class="ow-fb__title">{f.title}</span>
              {#if f.note}<span class="ow-fb__note">{f.note}</span>{/if}
            </span>
            <span class="ow-energy" style={`--tint:${ENERGY_TINT[f.energy]}`}>{f.energy}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="ow-empty">No focus blocks planned.</p>
    {/if}
  </div>

  <div class="ow-panel">
    <p class="ow-label">Daily review</p>
    <form class="ow-review" onsubmit={saveReview}>
      <label class="ow-rf"><span>Shipped</span><input bind:value={shipped} placeholder="What got done" /></label>
      <label class="ow-rf"><span>Open loops</span><input bind:value={openLoops} placeholder="Still hanging" /></label>
      <label class="ow-rf"><span>Agent handoffs</span><input bind:value={agentHandoffs} placeholder="Delegated to agents" /></label>
      <label class="ow-rf"><span>Tomorrow's first move</span><input bind:value={tomorrowFirstMove} placeholder="The one thing" /></label>
      <div class="ow-review__foot">
        <Button type="submit" variant="primary">{busy ? "Saving…" : "Save review →"}</Button>
        {#if savedNote}<span class="ow-saved mono">saved · emitted <code>daily_review.saved</code></span>{/if}
      </div>
    </form>
  </div>
</section>

<style>
  .ow-head { margin-bottom: 1.5rem; }
  .ow-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .ow-lede { color: var(--color-ink-soft); max-width: 68ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .ow-lede strong { color: var(--color-ink); font-weight: 600; }
  .ow-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 76ch; }
  .ow-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .ow-how strong { color: var(--color-ink); font-weight: 600; }
  .ow-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .ow-how__n { color: var(--color-green); font-size: 0.72rem; }

  .ow-summary { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .ow-stat { display: inline-flex; align-items: baseline; gap: 0.4rem; border: 1px solid var(--color-line-strong); border-radius: 10px; background: var(--color-panel); padding: 0.5rem 0.75rem; }
  .ow-stat__n { font-family: var(--font-display); font-weight: 800; font-size: 1.2rem; color: var(--color-ink); }
  .ow-stat__k { font-size: 0.72rem; color: var(--color-ink-faint); }

  .ow-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.8rem; margin-bottom: 1.4rem; }
  @media (max-width: 720px) { .ow-board { grid-template-columns: 1fr; } }
  .ow-col { border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 0.8rem; }
  .ow-col__h { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-faint); font-weight: 600; margin: 0 0 0.6rem; display: flex; justify-content: space-between; }
  .ow-cards { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.45rem; }
  .ow-card { background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 10px; padding: 0.6rem 0.7rem; display: grid; gap: 0.35rem; }
  .ow-card__top { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.5rem; }
  .ow-prio { width: 8px; height: 8px; border-radius: 999px; background: var(--tint); flex: none; }
  .ow-card__title { font-weight: 600; font-size: 0.86rem; }
  .ow-src { font-size: 0.85rem; }
  .ow-card__detail { font-size: 0.76rem; color: var(--color-ink-soft); margin: 0; }
  .ow-card__foot { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .ow-card__meta { font-size: 0.68rem; color: var(--color-ink-faint); }
  .ow-card__nav { display: inline-flex; gap: 0.25rem; flex: none; }
  .ow-mv { font: inherit; font-size: 0.85rem; line-height: 1; background: transparent; border: 1px solid var(--color-line-strong); color: var(--color-ink-soft); border-radius: 6px; padding: 0.1rem 0.4rem; cursor: pointer; }
  .ow-mv:hover:not(:disabled) { border-color: var(--color-green); color: var(--color-green); }
  .ow-empty { color: var(--color-ink-faint); font-size: 0.8rem; text-align: center; padding: 0.3rem; }

  .ow-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
  @media (max-width: 720px) { .ow-grid { grid-template-columns: 1fr; } }
  .ow-panel { border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1rem 1.1rem; }
  .ow-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; margin: 0 0 0.7rem; }

  .ow-focus { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
  .ow-fb { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.7rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 10px; padding: 0.5rem 0.7rem; }
  .ow-fb__time { font-size: 0.74rem; color: var(--color-ink-faint); white-space: nowrap; }
  .ow-fb__main { display: grid; min-width: 0; }
  .ow-fb__title { font-weight: 600; font-size: 0.85rem; }
  .ow-fb__note { font-size: 0.72rem; color: var(--color-ink-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ow-energy { font-family: var(--font-mono); font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.18rem 0.45rem; border-radius: 999px; color: var(--tint); background: color-mix(in srgb, var(--tint) 14%, transparent); flex: none; }

  .ow-review { display: grid; gap: 0.55rem; }
  .ow-rf { display: grid; gap: 0.2rem; }
  .ow-rf span { font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-faint); font-weight: 600; }
  .ow-rf input { width: 100%; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.45rem 0.6rem; font: inherit; font-size: 0.85rem; }
  .ow-rf input:focus { outline: none; border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }
  .ow-review__foot { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; margin-top: 0.2rem; }
  .ow-saved { font-size: 0.74rem; color: var(--color-green); }
  .ow-saved code { font-family: var(--font-mono); }
</style>

<!--
  Jobs & Workflows surface — explains and demonstrates what the module does (durable
  background jobs with idempotent enqueue, exponential-backoff retries, a dead-letter
  sink and an append-only run log). Built on the shared DS; jobs/runs/schedules +
  handlers are host-supplied. The point shown here: a failing job is retried with
  growing backoff until maxAttempts, then parked as dead — never lost, never looped
  forever — and every attempt is recorded. Reused by the harness and templates.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type Status = "pending" | "running" | "succeeded" | "dead";
  type Job = { id: string; type: string; status: Status; attempts: number; maxAttempts: number; runAt: string; lastError: string | null; idempotencyKey: string | null };
  type Run = { id: string; jobType: string; attempt: number; status: "succeeded" | "failed"; error: string | null; finishedAt: string };
  type Schedule = { id: string; type: string; intervalMs: number; nextRunAt: string };

  let {
    enqueueTypes = [],
    jobs = [],
    runs = [],
    schedules = [],
    lastEnqueue = null,
    busy = false,
    onenqueue,
    onrundue
  }: {
    enqueueTypes?: { type: string; label: string }[];
    jobs?: Job[];
    runs?: Run[];
    schedules?: Schedule[];
    lastEnqueue?: { type: string; deduped: boolean } | null;
    busy?: boolean;
    onenqueue?: (type: string) => void;
    onrundue?: () => void;
  } = $props();

  const STATUS_TINT: Record<Status, string> = { pending: "#3b82f6", running: "#8b5cf6", succeeded: "#0c8f5a", dead: "#ef4444" };
  const dueCount = $derived(jobs.filter((j) => j.status === "pending" && new Date(j.runAt).getTime() <= Date.now()).length);

  const rel = (iso: string) => {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "due now";
    const s = Math.round(ms / 1000);
    return s < 60 ? `runs in ${s}s` : `runs in ${Math.round(s / 60)}m`;
  };
  const ago = (iso: string) => {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
  };
  const everyLabel = (ms: number) => (ms % 86400000 === 0 ? `${ms / 86400000}d` : ms % 3600000 === 0 ? `${ms / 3600000}h` : `${Math.round(ms / 60000)}m`);
</script>

<header class="jw-head">
  <Eyebrow>Jobs &amp; workflows</Eyebrow>
  <h1 class="jw-title">Jobs &amp; Workflows</h1>
  <p class="jw-lede">Durable background jobs: <strong>idempotent enqueue</strong>, <strong>exponential-backoff retries</strong>, and a <strong>dead-letter sink</strong>. A failing job is retried with growing backoff until <code>maxAttempts</code>, then parked as <code>dead</code> — never lost, never looped forever — and every attempt is recorded.</p>
  <ol class="jw-how">
    <li><span class="jw-how__n mono">01</span><span><strong>Enqueue</strong> — idempotent by key (same key returns the existing job); emits <code>job.enqueued</code>.</span></li>
    <li><span class="jw-how__n mono">02</span><span><strong>Run</strong> — success emits <code>job.succeeded</code>; failure retries with backoff (<code>job.retried</code>) or dead-letters (<code>job.dead</code>).</span></li>
    <li><span class="jw-how__n mono">03</span><span><strong>Schedule</strong> — recurring jobs with catch-up; emits <code>job.scheduled</code>.</span></li>
  </ol>
</header>

<section class="jw-console" aria-label="Enqueue and run jobs">
  <div class="jw-console__rail" aria-hidden="true"></div>
  <div class="jw-bar">
    <div>
      <p class="jw-label">Enqueue a job</p>
      <div class="jw-enq">
        {#each enqueueTypes as t}
          <button type="button" class="jw-enq__b" disabled={busy} onclick={() => onenqueue?.(t.type)}>+ {t.label}</button>
        {/each}
      </div>
    </div>
    <div class="jw-run">
      <Button variant="primary" disabled={busy || !dueCount} onclick={() => onrundue?.()}>Run due jobs{#if dueCount} ({dueCount}){/if}</Button>
    </div>
  </div>
  {#if lastEnqueue}
    <p class="jw-enqnote mono">
      {#if lastEnqueue.deduped}<span class="jw-dedup">deduped</span> — idempotency key matched an existing <code>{lastEnqueue.type}</code> job{:else}enqueued <code>{lastEnqueue.type}</code>{/if}
    </p>
  {/if}
</section>

<div class="jw-out">
  <p class="jw-out__h mono">Jobs <span>({jobs.length})</span></p>
  {#if jobs.length}
    <ul class="jw-jobs">
      {#each jobs as j (j.id)}
        <li class="jw-job" class:dead={j.status === "dead"}>
          <span class="jw-job__dot" style={`--tint:${STATUS_TINT[j.status]}`} aria-hidden="true"></span>
          <span class="jw-job__main">
            <span class="jw-job__type mono">{j.type}{#if j.idempotencyKey}<span class="jw-key" title={`idempotency: ${j.idempotencyKey}`}>🔑</span>{/if}</span>
            {#if j.lastError}<span class="jw-job__err">{j.lastError}</span>{/if}
          </span>
          <span class="jw-job__attempts mono">{j.attempts}/{j.maxAttempts}</span>
          <span class="jw-job__when mono">{j.status === "pending" ? rel(j.runAt) : ""}</span>
          <span class="jw-pill" style={`--tint:${STATUS_TINT[j.status]}`}>{j.status}</span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="jw-empty">Enqueue a job to populate the queue.</p>
  {/if}
</div>

<div class="jw-cols">
  <div class="jw-col">
    <p class="jw-out__h mono">Run log <span>({runs.length})</span> · append-only</p>
    {#if runs.length}
      <ul class="jw-runs">
        {#each runs as r (r.id)}
          <li class="jw-runrow">
            <span class="jw-runrow__st jw-runrow__st--{r.status}">{r.status === "succeeded" ? "✓" : "✕"}</span>
            <span class="jw-runrow__type mono">{r.jobType} <span class="jw-runrow__att">#{r.attempt}</span></span>
            <span class="jw-runrow__err">{r.error ?? ""}</span>
            <span class="jw-runrow__when mono">{ago(r.finishedAt)}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="jw-empty">Run due jobs to record attempts.</p>
    {/if}
  </div>

  <div class="jw-col">
    <p class="jw-out__h mono">Schedules <span>({schedules.length})</span></p>
    {#if schedules.length}
      <ul class="jw-scheds">
        {#each schedules as s (s.id)}
          <li class="jw-sched">
            <span class="jw-sched__type mono">{s.type}</span>
            <span class="jw-sched__every">every {everyLabel(s.intervalMs)}</span>
            <span class="jw-sched__next mono">{rel(s.nextRunAt)}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="jw-empty">No schedules.</p>
    {/if}
  </div>
</div>

<style>
  .jw-head { margin-bottom: 1.5rem; }
  .jw-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .jw-lede { color: var(--color-ink-soft); max-width: 68ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .jw-lede strong { color: var(--color-ink); font-weight: 600; }
  .jw-lede code, .jw-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .jw-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 76ch; }
  .jw-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .jw-how strong { color: var(--color-ink); font-weight: 600; }
  .jw-how__n { color: var(--color-green); font-size: 0.72rem; }

  .jw-console { position: relative; border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1.1rem 1.2rem 1.1rem 1.4rem; overflow: hidden; margin-bottom: 1.4rem; }
  .jw-console__rail { position: absolute; inset: 0 auto 0 0; width: 3px; background: linear-gradient(180deg, var(--color-green), transparent); opacity: 0.7; }
  .jw-bar { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
  .jw-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; margin: 0 0 0.5rem; }
  .jw-enq { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .jw-enq__b { font: inherit; font-size: 0.78rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink-soft); border-radius: 8px; padding: 0.4rem 0.65rem; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
  .jw-enq__b:hover:not(:disabled) { border-color: var(--color-green); color: var(--color-green); }
  .jw-enq__b:disabled { opacity: 0.5; cursor: default; }
  .jw-enqnote { font-size: 0.74rem; color: var(--color-ink-faint); margin: 0.7rem 0 0; }
  .jw-enqnote code { color: var(--color-ink); }
  .jw-dedup { color: #b45309; font-weight: 600; }

  .jw-out__h { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-ink-faint); margin: 0 0 0.6rem; }
  .jw-empty { color: var(--color-ink-faint); font-size: 0.85rem; }

  .jw-jobs { list-style: none; margin: 0 0 1.4rem; padding: 0; display: grid; gap: 0.4rem; }
  .jw-job { display: grid; grid-template-columns: auto 1fr auto auto auto; align-items: center; gap: 0.7rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 10px; padding: 0.55rem 0.75rem; }
  .jw-job.dead { border-color: color-mix(in srgb, #ef4444 35%, var(--color-line-strong)); }
  .jw-job__dot { width: 8px; height: 8px; border-radius: 999px; background: var(--tint); flex: none; }
  .jw-job__main { display: grid; min-width: 0; }
  .jw-job__type { font-size: 0.85rem; font-weight: 600; color: var(--color-ink); display: inline-flex; align-items: center; gap: 0.3rem; }
  .jw-key { font-size: 0.7rem; }
  .jw-job__err { font-size: 0.72rem; color: #9b2c2c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .jw-job__attempts { font-size: 0.74rem; color: var(--color-ink-faint); }
  .jw-job__when { font-size: 0.72rem; color: var(--color-ink-faint); white-space: nowrap; }
  .jw-pill { font-family: var(--font-mono); font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.18rem 0.45rem; border-radius: 999px; color: var(--tint); background: color-mix(in srgb, var(--tint) 14%, transparent); flex: none; }

  .jw-cols { display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.2rem; align-items: start; }
  @media (max-width: 680px) { .jw-cols { grid-template-columns: 1fr; } }
  .jw-runs { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
  .jw-runrow { display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: 0.6rem; font-size: 0.8rem; padding: 0.4rem 0.55rem; border: 1px solid var(--color-line-strong); border-radius: 8px; background: var(--color-paper); }
  .jw-runrow__st { width: 1.2rem; height: 1.2rem; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; color: #fff; flex: none; }
  .jw-runrow__st--succeeded { background: #0c8f5a; }
  .jw-runrow__st--failed { background: #ef4444; }
  .jw-runrow__type { font-weight: 600; color: var(--color-ink); }
  .jw-runrow__att { color: var(--color-ink-faint); font-weight: 400; }
  .jw-runrow__err { font-size: 0.72rem; color: #9b2c2c; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .jw-runrow__when { font-size: 0.7rem; color: var(--color-ink-faint); white-space: nowrap; }

  .jw-scheds { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
  .jw-sched { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 0.6rem; font-size: 0.8rem; padding: 0.45rem 0.6rem; border: 1px solid var(--color-line-strong); border-radius: 8px; background: var(--color-paper); }
  .jw-sched__type { font-weight: 600; color: var(--color-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .jw-sched__every { font-size: 0.72rem; color: var(--color-ink-faint); }
  .jw-sched__next { font-size: 0.72rem; color: var(--color-green); white-space: nowrap; }
</style>

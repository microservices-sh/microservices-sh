<!--
  Audit Log surface — explains and demonstrates what the module does (an append-only
  sink that records every domain event other modules emit, queryable and
  exportable). Built on the shared DS; the recorded events + handlers are
  host-supplied. The point shown here: it is append-only — events are recorded,
  never edited or deleted, so the trail is tamper-evident and reconstructable.
  Reused by the harness and template routes.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type AuditEvent = { id: string; eventName: string; actorId: string | null; entityType: string | null; entityId: string | null; source: string | null; createdAt: string };

  let {
    events = [],
    busy = false,
    onconsume,
    onexport
  }: {
    events?: AuditEvent[];
    busy?: boolean;
    onconsume?: (kind: string) => void;
    onexport?: () => void;
  } = $props();

  const SOURCES = ["booking", "payment", "invoice", "org-team-rbac", "billing-subscriptions"];
  const TINT: Record<string, string> = {
    booking: "#3b82f6",
    payment: "#0c8f5a",
    invoice: "#6366f1",
    "org-team-rbac": "#8b5cf6",
    "billing-subscriptions": "#f59e0b"
  };
  const tint = (s: string | null) => TINT[s ?? ""] ?? "#94a3b8";

  let filter = $state("");
  const entityTypes = $derived([...new Set(events.map((e) => e.entityType).filter(Boolean))] as string[]);
  const shown = $derived(filter ? events.filter((e) => e.entityType === filter) : events);

  let exported = $state<number | null>(null);
  function exportTrail() {
    onexport?.();
    exported = events.length; // emits audit.exported
  }

  const when = (iso: string) => new Date(iso).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
</script>

<header class="al-head">
  <Eyebrow>Audit log</Eyebrow>
  <h1 class="al-title">Audit Log</h1>
  <p class="al-lede">An <strong>append-only sink</strong> that records every domain event your other modules emit — bookings, payments, role changes — into one queryable, exportable trail. Events are <strong>recorded, never edited or deleted</strong>, so the history is tamper-evident.</p>
  <ol class="al-how">
    <li><span class="al-how__n mono">01</span><span><strong>Consume</strong> — any signed event envelope from another module is recorded; emits <code>audit.recorded</code>.</span></li>
    <li><span class="al-how__n mono">02</span><span><strong>Query</strong> — filter the trail by entity type, event name, or actor.</span></li>
    <li><span class="al-how__n mono">03</span><span><strong>Export</strong> — hand the filtered trail to compliance; emits <code>audit.exported</code>.</span></li>
  </ol>
</header>

<section class="al-console" aria-label="Audit trail">
  <div class="al-bar">
    <p class="al-label">Record an event <em>· consume-event</em></p>
    <div class="al-emit">
      {#each SOURCES as s}
        <button type="button" class="al-emit__b" style={`--tint:${tint(s)}`} disabled={busy} onclick={() => onconsume?.(s)}>+ {s}</button>
      {/each}
    </div>
  </div>

  <div class="al-filters">
    <span class="al-fcount mono">{shown.length} of {events.length} events</span>
    <span class="al-chips">
      <button type="button" class="al-chip" class:on={filter === ""} onclick={() => (filter = "")}>all</button>
      {#each entityTypes as et}
        <button type="button" class="al-chip" class:on={filter === et} onclick={() => (filter = et)}>{et}</button>
      {/each}
    </span>
    <button type="button" class="al-export" disabled={!shown.length} onclick={exportTrail}>Export ↧</button>
  </div>

  {#if shown.length}
    <ul class="al-stream">
      {#each shown as e (e.id)}
        <li class="al-row">
          <span class="al-row__rail" style={`--tint:${tint(e.source)}`} aria-hidden="true"></span>
          <span class="al-row__body">
            <span class="al-row__top">
              <span class="al-row__name mono">{e.eventName}</span>
              <span class="al-row__src" style={`--tint:${tint(e.source)}`}>{e.source}</span>
            </span>
            <span class="al-row__meta mono">
              {#if e.entityType}{e.entityType}{#if e.entityId} · {e.entityId}{/if}{/if}
              {#if e.actorId} · by {e.actorId}{/if}
            </span>
          </span>
          <span class="al-row__when mono">{when(e.createdAt)}</span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="al-empty">No events{filter ? ` for "${filter}"` : ""} yet — record one above.</p>
  {/if}

  {#if exported !== null}
    <p class="al-exported mono">exported {exported} event{exported === 1 ? "" : "s"} · emitted <span>audit.exported</span></p>
  {/if}
</section>

<style>
  .al-head { margin-bottom: 1.5rem; }
  .al-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .al-lede { color: var(--color-ink-soft); max-width: 66ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .al-lede strong { color: var(--color-ink); font-weight: 600; }
  .al-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 72ch; }
  .al-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .al-how strong { color: var(--color-ink); font-weight: 600; }
  .al-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .al-how__n { color: var(--color-green); font-size: 0.72rem; }

  .al-console { border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1.1rem 1.2rem; }
  .al-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; margin: 0 0 0.5rem; }
  .al-label em { font-style: normal; opacity: 0.7; text-transform: none; letter-spacing: 0; }
  .al-emit { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .al-emit__b { font: inherit; font-size: 0.76rem; background: var(--color-paper); border: 1px solid color-mix(in srgb, var(--tint) 35%, var(--color-line-strong)); color: var(--tint); border-radius: 999px; padding: 0.32rem 0.65rem; cursor: pointer; transition: background 0.15s; }
  .al-emit__b:hover:not(:disabled) { background: color-mix(in srgb, var(--tint) 12%, transparent); }
  .al-emit__b:disabled { opacity: 0.5; cursor: default; }

  .al-filters { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; margin: 1rem 0 0.7rem; padding-top: 0.8rem; border-top: 1px solid var(--color-line-strong); }
  .al-fcount { font-size: 0.72rem; color: var(--color-ink-faint); }
  .al-chips { display: inline-flex; gap: 0.3rem; flex-wrap: wrap; flex: 1 1 auto; }
  .al-chip { font: inherit; font-size: 0.74rem; background: transparent; border: 1px solid var(--color-line-strong); color: var(--color-ink-soft); border-radius: 999px; padding: 0.25rem 0.6rem; cursor: pointer; }
  .al-chip.on { border-color: var(--color-green); color: var(--color-green); background: color-mix(in srgb, var(--color-green) 8%, transparent); }
  .al-export { font: inherit; font-size: 0.76rem; background: transparent; border: 1px solid var(--color-line-strong); color: var(--color-ink-soft); border-radius: 8px; padding: 0.35rem 0.65rem; cursor: pointer; }
  .al-export:hover:not(:disabled) { border-color: var(--color-green); color: var(--color-green); }
  .al-export:disabled { opacity: 0.45; cursor: default; }

  .al-stream { list-style: none; margin: 0; padding: 0; display: grid; }
  .al-row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.7rem; padding: 0.55rem 0; border-bottom: 1px solid color-mix(in srgb, var(--color-line-strong) 55%, transparent); }
  .al-row:last-child { border-bottom: none; }
  .al-row__rail { width: 8px; height: 8px; border-radius: 999px; background: var(--tint); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tint) 16%, transparent); flex: none; }
  .al-row__body { display: grid; min-width: 0; gap: 0.1rem; }
  .al-row__top { display: flex; align-items: baseline; gap: 0.6rem; min-width: 0; }
  .al-row__name { font-size: 0.85rem; font-weight: 600; color: var(--color-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .al-row__src { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tint); flex: none; }
  .al-row__meta { font-size: 0.72rem; color: var(--color-ink-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .al-row__when { font-size: 0.7rem; color: var(--color-ink-faint); white-space: nowrap; }
  .al-empty { color: var(--color-ink-faint); font-size: 0.85rem; margin: 0.5rem 0 0; }
  .al-exported { font-size: 0.74rem; color: var(--color-ink-faint); margin: 0.8rem 0 0; }
  .al-exported span { color: var(--color-green); }
</style>

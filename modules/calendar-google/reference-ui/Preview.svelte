<!--
  Google Calendar Sync surface — explains and demonstrates what the module does
  (keep a deduped local cache of a Google calendar via incremental syncToken sync,
  with OAuth token refresh and watch-channel renewal). Built on the shared DS;
  connection/token/channel/sync state + events + handlers are host-supplied. The
  point shown here: sync is incremental (a syncToken cursor), a 410 Gone forces a
  full resync, and events are deduped — re-syncing an unchanged batch is a no-op.
  Reused by the harness and template routes.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type EventRow = { id: string; summary: string; status: "confirmed" | "tentative" | "cancelled"; startAt: string | null; recurring: boolean };
  type SyncResult = { upserted: number; deleted: number; deduped: number; full: boolean };

  let {
    calendarId = "primary",
    connected = false,
    tokenFresh = true,
    tokenExpiresLabel = "",
    channelExpiresDays = 7,
    syncToken = null,
    events = [],
    lastSync = null,
    busy = false,
    onconnect,
    onsync,
    onresync,
    onrefreshtoken,
    onrenewchannel
  }: {
    calendarId?: string;
    connected?: boolean;
    tokenFresh?: boolean;
    tokenExpiresLabel?: string;
    channelExpiresDays?: number;
    syncToken?: string | null;
    events?: EventRow[];
    lastSync?: SyncResult | null;
    busy?: boolean;
    onconnect?: () => void;
    onsync?: () => void;
    onresync?: () => void;
    onrefreshtoken?: () => void;
    onrenewchannel?: () => void;
  } = $props();

  const STATUS_TINT = { confirmed: "#0c8f5a", tentative: "#f59e0b", cancelled: "#94a3b8" };
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
  const active = $derived(events.filter((e) => e.status !== "cancelled"));
</script>

<header class="cg-head">
  <Eyebrow>Google Calendar sync</Eyebrow>
  <h1 class="cg-title">Google Calendar Sync</h1>
  <p class="cg-lede">Keep a <strong>deduped local cache</strong> of a Google calendar via <strong>incremental sync</strong> — a <code>syncToken</code> cursor pulls only what changed, a <code>410 Gone</code> forces a full resync, and OAuth tokens + watch channels are refreshed before they expire so delivery never silently stops.</p>
  <ol class="cg-how">
    <li><span class="cg-how__n mono">01</span><span><strong>Connect</strong> — OAuth a calendar; emits <code>calendar-google.connected</code>.</span></li>
    <li><span class="cg-how__n mono">02</span><span><strong>Sync</strong> — incremental by <code>syncToken</code>; emits <code>synced</code> + per-event <code>upserted</code>/<code>deleted</code>.</span></li>
    <li><span class="cg-how__n mono">03</span><span><strong>Stay live</strong> — refresh the token and renew the channel before expiry.</span></li>
  </ol>
</header>

{#if !connected}
  <section class="cg-connect">
    <p class="cg-connect__txt">No calendar connected.</p>
    <Button variant="primary" disabled={busy} onclick={() => onconnect?.()}>Connect Google Calendar →</Button>
  </section>
{:else}
  <section class="cg-strip" aria-label="Connection health">
    <div class="cg-cell">
      <span class="cg-cell__k">Calendar</span>
      <span class="cg-cell__v mono">{calendarId}</span>
      <span class="cg-cell__sub cg-ok">connected</span>
    </div>
    <div class="cg-cell">
      <span class="cg-cell__k">Sync cursor</span>
      <span class="cg-cell__v mono">{syncToken ? syncToken : "— (full sync)"}</span>
      <span class="cg-cell__sub">{syncToken ? "incremental" : "first run / invalidated"}</span>
    </div>
    <div class="cg-cell">
      <span class="cg-cell__k">Access token</span>
      <span class="cg-cell__v" class:cg-warn={!tokenFresh}>{tokenFresh ? "fresh" : "expiring"}</span>
      <span class="cg-cell__sub">{tokenExpiresLabel}{#if !tokenFresh} · <button type="button" class="cg-mini" onclick={() => onrefreshtoken?.()}>refresh</button>{/if}</span>
    </div>
    <div class="cg-cell">
      <span class="cg-cell__k">Watch channel</span>
      <span class="cg-cell__v" class:cg-warn={channelExpiresDays <= 1}>{channelExpiresDays}d left</span>
      <span class="cg-cell__sub">{channelExpiresDays <= 1 ? "renew now" : "auto-renews"}{#if channelExpiresDays <= 1} · <button type="button" class="cg-mini" onclick={() => onrenewchannel?.()}>renew</button>{/if}</span>
    </div>
  </section>

  <section class="cg-sync">
    <div class="cg-sync__actions">
      <Button variant="primary" disabled={busy} onclick={() => onsync?.()}>Sync now</Button>
      <button type="button" class="cg-btn" disabled={busy} onclick={() => onresync?.()}>Simulate 410 Gone → full resync</button>
    </div>
    {#if lastSync}
      <p class="cg-result mono">
        {lastSync.full ? "full resync" : "incremental"} · {lastSync.upserted} upserted · {lastSync.deleted} deleted
        {#if lastSync.deduped > 0} · <span class="cg-dedup">{lastSync.deduped} deduped (unchanged)</span>{/if}
      </p>
    {/if}
  </section>

  <div class="cg-out">
    <p class="cg-out__h mono">Cached events <span>({active.length})</span></p>
    {#if events.length}
      <ul class="cg-events">
        {#each events as e (e.id)}
          <li class="cg-ev" class:cancelled={e.status === "cancelled"}>
            <span class="cg-ev__dot" style={`--tint:${STATUS_TINT[e.status]}`} aria-hidden="true"></span>
            <span class="cg-ev__main">
              <span class="cg-ev__sum">{e.summary}{#if e.recurring}<span class="cg-ev__rec mono">↻ recurring</span>{/if}</span>
              <span class="cg-ev__when mono">{when(e.startAt)}</span>
            </span>
            <span class="cg-ev__status" style={`--tint:${STATUS_TINT[e.status]}`}>{e.status}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="cg-empty">Sync to pull events into the local cache.</p>
    {/if}
  </div>
{/if}

<style>
  .cg-head { margin-bottom: 1.5rem; }
  .cg-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .cg-lede { color: var(--color-ink-soft); max-width: 66ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .cg-lede strong { color: var(--color-ink); font-weight: 600; }
  .cg-lede code, .cg-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .cg-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 72ch; }
  .cg-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .cg-how strong { color: var(--color-ink); font-weight: 600; }
  .cg-how__n { color: var(--color-green); font-size: 0.72rem; }

  .cg-connect { border: 1px dashed var(--color-line-strong); border-radius: 14px; background: var(--color-panel-subtle); padding: 2rem; text-align: center; display: grid; gap: 0.8rem; justify-items: center; }
  .cg-connect__txt { color: var(--color-ink-faint); margin: 0; font-size: 0.9rem; }

  .cg-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.6rem; margin-bottom: 0.9rem; }
  .cg-cell { border: 1px solid var(--color-line-strong); border-radius: 11px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 0.7rem 0.8rem; display: grid; gap: 0.15rem; }
  .cg-cell__k { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-faint); font-weight: 600; }
  .cg-cell__v { font-size: 0.92rem; font-weight: 600; color: var(--color-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cg-cell__v.cg-warn { color: #b45309; }
  .cg-cell__sub { font-size: 0.7rem; color: var(--color-ink-faint); }
  .cg-ok { color: var(--color-green); }
  .cg-mini { font: inherit; font-size: 0.7rem; background: transparent; border: none; color: var(--color-green); cursor: pointer; padding: 0; text-decoration: underline; }

  .cg-sync { margin-bottom: 1.4rem; }
  .cg-sync__actions { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; }
  .cg-btn { font: inherit; font-size: 0.8rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink-soft); border-radius: 9px; padding: 0.5rem 0.75rem; cursor: pointer; }
  .cg-btn:hover:not(:disabled) { border-color: color-mix(in srgb, #f59e0b 45%, var(--color-line-strong)); color: #b45309; }
  .cg-result { font-size: 0.76rem; color: var(--color-ink-faint); margin: 0.7rem 0 0; }
  .cg-dedup { color: var(--color-green); }

  .cg-out__h { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-ink-faint); margin: 0 0 0.6rem; }
  .cg-empty { color: var(--color-ink-faint); font-size: 0.85rem; }
  .cg-events { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
  .cg-ev { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.7rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 10px; padding: 0.55rem 0.75rem; }
  .cg-ev.cancelled { opacity: 0.5; }
  .cg-ev.cancelled .cg-ev__sum { text-decoration: line-through; }
  .cg-ev__dot { width: 8px; height: 8px; border-radius: 999px; background: var(--tint); flex: none; }
  .cg-ev__main { display: grid; min-width: 0; }
  .cg-ev__sum { font-weight: 600; font-size: 0.88rem; display: flex; align-items: baseline; gap: 0.5rem; }
  .cg-ev__rec { font-size: 0.68rem; color: var(--color-ink-faint); font-weight: 400; }
  .cg-ev__when { font-size: 0.74rem; color: var(--color-ink-faint); }
  .cg-ev__status { font-family: var(--font-mono); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tint); flex: none; }
</style>

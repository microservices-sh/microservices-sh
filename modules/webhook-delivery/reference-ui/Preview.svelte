<!--
  Webhook Delivery surface — explains and demonstrates what the module does (the
  outbound mirror of the event bus: register external endpoints with a per-endpoint
  signing secret, fan out HMAC-signed domain events to the ones subscribed, and log
  every delivery attempt). Built on the shared DS; endpoints/deliveries + handlers
  are host-supplied. The point shown here: each endpoint only receives the events it
  subscribed to, signed with its OWN secret. Reused by the harness and templates.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type Endpoint = { id: string; url: string; eventNames: string[]; secret: string; active: boolean };
  type Delivery = { id: string; endpointUrl: string; eventName: string; status: "delivered" | "failed"; statusCode: number | null; error: string | null; createdAt: string };

  let {
    endpoints = [],
    deliveries = [],
    emitEvents = [],
    busy = false,
    onregister,
    onemit,
    ontoggle
  }: {
    endpoints?: Endpoint[];
    deliveries?: Delivery[];
    emitEvents?: string[];
    busy?: boolean;
    onregister?: (input: { url: string; eventNames: string[] }) => void;
    onemit?: (eventName: string) => void;
    ontoggle?: (endpointId: string) => void;
  } = $props();

  let url = $state("https://api.partner.com/hooks/msh");
  let scope = $state("all");

  const matches = (e: Endpoint, name: string) => e.active && (e.eventNames.length === 0 || e.eventNames.includes(name));
  const maskSecret = (s: string) => s.slice(0, 8) + "•".repeat(8);
  const when = (iso: string) => new Date(iso).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", second: "2-digit" });

  function register(e: Event) {
    e.preventDefault();
    if (!url.trim()) return;
    onregister?.({ url: url.trim(), eventNames: scope === "all" ? [] : [scope] });
    url = "https://api.partner.com/hooks/msh";
  }
</script>

<header class="wh-head">
  <Eyebrow>Webhook delivery</Eyebrow>
  <h1 class="wh-title">Webhook Delivery</h1>
  <p class="wh-lede">The <strong>outbound mirror of the event bus</strong>: register external endpoints, then fan out your domain events to the ones subscribed — each delivery is <strong>HMAC-signed with that endpoint's own secret</strong>, and every attempt is logged with its response code.</p>
  <ol class="wh-how">
    <li><span class="wh-how__n mono">01</span><span><strong>Register</strong> — a URL, an event filter (or all), and a per-endpoint signing secret.</span></li>
    <li><span class="wh-how__n mono">02</span><span><strong>Fan out</strong> — a domain event is delivered only to subscribed, active endpoints, signed per endpoint.</span></li>
    <li><span class="wh-how__n mono">03</span><span><strong>Log</strong> — each attempt records its status; emits <code>webhook.delivered</code> or <code>webhook.failed</code>.</span></li>
  </ol>
</header>

<section class="wh-emit" aria-label="Emit a domain event">
  <div class="wh-emit__rail" aria-hidden="true"></div>
  <p class="wh-label">Emit a domain event</p>
  <div class="wh-emit__btns">
    {#each emitEvents as ev}
      {@const n = endpoints.filter((e) => matches(e, ev)).length}
      <button type="button" class="wh-ev" disabled={busy} onclick={() => onemit?.(ev)}>
        <span class="mono">{ev}</span><span class="wh-ev__n">→ {n}</span>
      </button>
    {/each}
  </div>
</section>

<section class="wh-grid">
  <div class="wh-panel">
    <p class="wh-label">Endpoints <span class="mono">({endpoints.length})</span></p>
    <ul class="wh-endpoints">
      {#each endpoints as e (e.id)}
        <li class="wh-ep" class:off={!e.active}>
          <div class="wh-ep__top">
            <span class="wh-ep__url mono">{e.url}</span>
            <button type="button" class="wh-toggle" class:on={e.active} role="switch" aria-checked={e.active} aria-label={e.active ? "Deactivate endpoint" : "Activate endpoint"} onclick={() => ontoggle?.(e.id)}>
              <span class="wh-toggle__dot"></span>
            </button>
          </div>
          <div class="wh-ep__meta">
            <span class="wh-ep__scope">{e.eventNames.length === 0 ? "all events" : e.eventNames.join(", ")}</span>
            <span class="wh-ep__secret mono" title="per-endpoint signing secret">🔐 {maskSecret(e.secret)}</span>
          </div>
        </li>
      {/each}
    </ul>

    <form class="wh-reg" onsubmit={register}>
      <input class="wh-reg__url" bind:value={url} placeholder="https://…/webhook" aria-label="Endpoint URL" />
      <div class="wh-reg__row">
        <select bind:value={scope} aria-label="Event filter">
          <option value="all">all events</option>
          {#each emitEvents as ev}<option value={ev}>{ev}</option>{/each}
        </select>
        <Button type="submit" variant="ghost">Register</Button>
      </div>
    </form>
  </div>

  <div class="wh-panel">
    <p class="wh-label">Delivery log <span class="mono">({deliveries.length})</span></p>
    {#if deliveries.length}
      <ul class="wh-log">
        {#each deliveries as d (d.id)}
          <li class="wh-del">
            <span class="wh-del__st wh-del__st--{d.status}">{d.status === "delivered" ? "✓" : "✕"}</span>
            <span class="wh-del__main">
              <span class="wh-del__ev mono">{d.eventName}</span>
              <span class="wh-del__url">{d.endpointUrl}</span>
            </span>
            <span class="wh-del__code mono" class:bad={d.status === "failed"}>{d.statusCode ?? "—"}</span>
            <span class="wh-del__when mono">{when(d.createdAt)}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="wh-empty">Emit an event to fan out deliveries.</p>
    {/if}
  </div>
</section>

<style>
  .wh-head { margin-bottom: 1.5rem; }
  .wh-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .wh-lede { color: var(--color-ink-soft); max-width: 68ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .wh-lede strong { color: var(--color-ink); font-weight: 600; }
  .wh-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 76ch; }
  .wh-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .wh-how strong { color: var(--color-ink); font-weight: 600; }
  .wh-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .wh-how__n { color: var(--color-green); font-size: 0.72rem; }

  .wh-emit { position: relative; border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1rem 1.1rem 1.1rem 1.3rem; overflow: hidden; margin-bottom: 1rem; }
  .wh-emit__rail { position: absolute; inset: 0 auto 0 0; width: 3px; background: linear-gradient(180deg, var(--color-green), transparent); opacity: 0.7; }
  .wh-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; margin: 0 0 0.6rem; }
  .wh-emit__btns { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .wh-ev { display: inline-flex; align-items: center; gap: 0.45rem; font: inherit; font-size: 0.78rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.4rem 0.6rem; cursor: pointer; transition: border-color 0.15s; }
  .wh-ev:hover:not(:disabled) { border-color: var(--color-green); }
  .wh-ev:disabled { opacity: 0.5; cursor: default; }
  .wh-ev__n { font-size: 0.68rem; color: var(--color-ink-faint); }

  .wh-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
  @media (max-width: 720px) { .wh-grid { grid-template-columns: 1fr; } }
  .wh-panel { border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1rem 1.1rem; }

  .wh-endpoints { list-style: none; margin: 0 0 0.8rem; padding: 0; display: grid; gap: 0.45rem; }
  .wh-ep { background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 10px; padding: 0.6rem 0.7rem; display: grid; gap: 0.35rem; }
  .wh-ep.off { opacity: 0.55; }
  .wh-ep__top { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
  .wh-ep__url { font-size: 0.8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wh-ep__meta { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
  .wh-ep__scope { font-size: 0.72rem; color: var(--color-ink-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wh-ep__secret { font-size: 0.7rem; color: var(--color-ink-faint); flex: none; }
  .wh-toggle { width: 2rem; height: 1.15rem; border-radius: 999px; border: 1px solid var(--color-line-strong); background: var(--color-panel-subtle); position: relative; cursor: pointer; flex: none; padding: 0; transition: background 0.15s; }
  .wh-toggle.on { background: var(--color-green); border-color: var(--color-green); }
  .wh-toggle__dot { position: absolute; top: 50%; left: 2px; transform: translateY(-50%); width: 0.85rem; height: 0.85rem; border-radius: 999px; background: #fff; transition: left 0.15s; }
  .wh-toggle.on .wh-toggle__dot { left: calc(100% - 0.95rem); }

  .wh-reg { display: grid; gap: 0.5rem; }
  .wh-reg__url, .wh-reg select { width: 100%; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.45rem 0.6rem; font: inherit; font-size: 0.84rem; }
  .wh-reg__url:focus, .wh-reg select:focus { outline: none; border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }
  .wh-reg__row { display: flex; gap: 0.5rem; }
  .wh-reg__row select { flex: 1 1 auto; }

  .wh-empty { color: var(--color-ink-faint); font-size: 0.85rem; }
  .wh-log { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
  .wh-del { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 0.6rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 9px; padding: 0.45rem 0.6rem; }
  .wh-del__st { width: 1.2rem; height: 1.2rem; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; color: #fff; flex: none; }
  .wh-del__st--delivered { background: #0c8f5a; }
  .wh-del__st--failed { background: #ef4444; }
  .wh-del__main { display: grid; min-width: 0; }
  .wh-del__ev { font-size: 0.8rem; font-weight: 600; color: var(--color-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wh-del__url { font-size: 0.7rem; color: var(--color-ink-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wh-del__code { font-size: 0.74rem; color: #0c8f5a; flex: none; }
  .wh-del__code.bad { color: #9b2c2c; }
  .wh-del__when { font-size: 0.68rem; color: var(--color-ink-faint); flex: none; }
</style>

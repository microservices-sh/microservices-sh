<!--
  File & Media surface — explains and demonstrates what the module does (a two-phase
  upload: request a ticket, store the bytes at a tenant-scoped key, then complete it
  into a MediaFile). Built on the shared DS; tickets/files + handlers are
  host-supplied. The point shown here: bytes are never tracked until a ticket is
  completed, and an incomplete ticket expires — so R2 never accumulates orphans, and
  size/type are validated against the ticket's cap. Reused by the harness & templates.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type Ticket = { id: string; key: string; contentType: string; originalName: string; maxBytes: number; bytes: number; expiresAt: string };
  type MediaFile = { id: string; key: string; contentType: string; originalName: string; bytes: number; status: "active" | "deleted" };

  let {
    tickets = [],
    files = [],
    busy = false,
    onrequest,
    oncomplete,
    ondelete
  }: {
    tickets?: Ticket[];
    files?: MediaFile[];
    busy?: boolean;
    onrequest?: (input: { originalName: string; contentType: string; bytes: number; maxBytes: number }) => void;
    oncomplete?: (ticketId: string) => void;
    ondelete?: (fileId: string) => void;
  } = $props();

  // The "file picker": representative files the host could receive. maxBytes is the
  // per-type cap the ticket is created with; one sample is deliberately oversized.
  const SAMPLES = [
    { originalName: "hero-shot.jpg", contentType: "image/jpeg", bytes: 2_400_000, maxBytes: 10_000_000 },
    { originalName: "contract.pdf", contentType: "application/pdf", bytes: 840_000, maxBytes: 25_000_000 },
    { originalName: "walkthrough.mp4", contentType: "video/mp4", bytes: 64_000_000, maxBytes: 50_000_000 },
    { originalName: "avatar.png", contentType: "image/png", bytes: 180_000, maxBytes: 10_000_000 }
  ];
  let pick = $state(0);
  const sample = $derived(SAMPLES[pick]);

  const kb = (b: number) => (b < 1_000_000 ? `${Math.round(b / 1000)} KB` : `${(b / 1_000_000).toFixed(1)} MB`);
  function icon(ct: string): string {
    if (ct.startsWith("image/")) return "🖼️";
    if (ct.startsWith("video/")) return "🎬";
    if (ct === "application/pdf") return "📄";
    return "📎";
  }
  const overCap = (t: Ticket) => t.bytes > t.maxBytes;

  function request() {
    onrequest?.({ originalName: sample.originalName, contentType: sample.contentType, bytes: sample.bytes, maxBytes: sample.maxBytes });
  }
</script>

<header class="fm-head">
  <Eyebrow>Files &amp; media</Eyebrow>
  <h1 class="fm-title">File &amp; Media</h1>
  <p class="fm-lede">A <strong>two-phase upload</strong>: request a ticket, store the bytes at a <strong>tenant-scoped key</strong>, then complete it into a file. Bytes aren't tracked until completion and stale tickets expire — so storage never accumulates orphans, and size/type are validated against the ticket's cap.</p>
  <ol class="fm-how">
    <li><span class="fm-how__n mono">01</span><span><strong>Request ticket</strong> — reserves a key + size cap; emits <code>media.upload_requested</code>.</span></li>
    <li><span class="fm-how__n mono">02</span><span><strong>Complete</strong> — promotes the ticket to a MediaFile; emits <code>media.uploaded</code>.</span></li>
    <li><span class="fm-how__n mono">03</span><span><strong>Delete / expire</strong> — emits <code>media.deleted</code>; unfinished tickets emit <code>media.ticket_expired</code>.</span></li>
  </ol>
</header>

<section class="fm-console" aria-label="Upload a file">
  <div class="fm-console__rail" aria-hidden="true"></div>
  <p class="fm-label">Pick a file</p>
  <div class="fm-picker">
    {#each SAMPLES as s, i}
      <button type="button" class="fm-sample" class:on={i === pick} onclick={() => (pick = i)}>
        <span class="fm-sample__ico" aria-hidden="true">{icon(s.contentType)}</span>
        <span class="fm-sample__main">
          <span class="fm-sample__name">{s.originalName}</span>
          <span class="fm-sample__meta mono">{kb(s.bytes)} · cap {kb(s.maxBytes)}</span>
        </span>
      </button>
    {/each}
  </div>
  <div class="fm-req">
    <Button variant="primary" disabled={busy} onclick={request}>Request upload ticket →</Button>
    <span class="fm-hint mono">key: {`tenant_acme/<id>/${sample.originalName}`}</span>
  </div>

  {#if tickets.length}
    <p class="fm-label fm-label--mt">Pending tickets</p>
    <ul class="fm-tickets">
      {#each tickets as t (t.id)}
        <li class="fm-ticket" class:bad={overCap(t)}>
          <span class="fm-ticket__ico" aria-hidden="true">{icon(t.contentType)}</span>
          <span class="fm-ticket__main">
            <span class="fm-ticket__name">{t.originalName} <span class="fm-ticket__sz mono">{kb(t.bytes)}</span></span>
            <span class="fm-ticket__key mono">{t.key}</span>
          </span>
          {#if overCap(t)}
            <span class="fm-ticket__rej">exceeds cap {kb(t.maxBytes)} — rejected</span>
          {:else}
            <button type="button" class="fm-complete" disabled={busy} onclick={() => oncomplete?.(t.id)}>Complete upload</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<div class="fm-out">
  <p class="fm-out__h mono">Media library <span>({files.filter((f) => f.status === "active").length})</span></p>
  {#if files.some((f) => f.status === "active")}
    <ul class="fm-grid">
      {#each files.filter((f) => f.status === "active") as f (f.id)}
        <li class="fm-card">
          <span class="fm-card__ico" aria-hidden="true">{icon(f.contentType)}</span>
          <span class="fm-card__name">{f.originalName}</span>
          <span class="fm-card__meta mono">{f.contentType} · {kb(f.bytes)}</span>
          <button type="button" class="fm-del" aria-label="Delete file" onclick={() => ondelete?.(f.id)}>Delete</button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="fm-empty">Complete an upload to add a file to the library.</p>
  {/if}
</div>

<style>
  .fm-head { margin-bottom: 1.5rem; }
  .fm-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .fm-lede { color: var(--color-ink-soft); max-width: 66ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .fm-lede strong { color: var(--color-ink); font-weight: 600; }
  .fm-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 72ch; }
  .fm-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .fm-how strong { color: var(--color-ink); font-weight: 600; }
  .fm-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .fm-how__n { color: var(--color-green); font-size: 0.72rem; }

  .fm-console { position: relative; border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1.1rem 1.2rem 1.2rem 1.4rem; overflow: hidden; }
  .fm-console__rail { position: absolute; inset: 0 auto 0 0; width: 3px; background: linear-gradient(180deg, var(--color-green), transparent); opacity: 0.7; }
  .fm-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; margin: 0 0 0.6rem; }
  .fm-label--mt { margin-top: 1.1rem; }

  .fm-picker { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.5rem; }
  .fm-sample { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 0.6rem; text-align: left; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 10px; padding: 0.55rem 0.7rem; cursor: pointer; color: var(--color-ink); transition: border-color 0.15s, transform 0.15s; }
  .fm-sample:hover { transform: translateY(-1px); }
  .fm-sample.on { border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }
  .fm-sample__ico { font-size: 1.2rem; }
  .fm-sample__main { display: grid; min-width: 0; }
  .fm-sample__name { font-weight: 600; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fm-sample__meta { font-size: 0.7rem; color: var(--color-ink-faint); }

  .fm-req { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; margin-top: 0.9rem; }
  .fm-hint { font-size: 0.72rem; color: var(--color-ink-faint); }

  .fm-tickets { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
  .fm-ticket { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.7rem; background: var(--color-paper); border: 1px dashed var(--color-line-strong); border-radius: 10px; padding: 0.55rem 0.7rem; }
  .fm-ticket.bad { border-color: color-mix(in srgb, #ef4444 45%, transparent); }
  .fm-ticket__ico { font-size: 1.1rem; }
  .fm-ticket__main { display: grid; min-width: 0; }
  .fm-ticket__name { font-weight: 600; font-size: 0.85rem; }
  .fm-ticket__sz { font-size: 0.72rem; color: var(--color-ink-faint); font-weight: 400; }
  .fm-ticket__key { font-size: 0.68rem; color: var(--color-ink-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fm-complete { font: inherit; font-size: 0.76rem; background: transparent; border: 1px solid var(--color-line-strong); color: var(--color-green); border-radius: 8px; padding: 0.35rem 0.6rem; cursor: pointer; }
  .fm-complete:hover:not(:disabled) { border-color: var(--color-green); }
  .fm-ticket__rej { font-size: 0.74rem; color: #9b2c2c; font-weight: 600; }

  .fm-out { margin-top: 1.6rem; }
  .fm-out__h { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-ink-faint); margin: 0 0 0.6rem; }
  .fm-empty { color: var(--color-ink-faint); font-size: 0.85rem; }

  .fm-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.6rem; }
  .fm-card { display: grid; gap: 0.3rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 11px; padding: 0.8rem; text-align: center; justify-items: center; }
  .fm-card__ico { font-size: 1.8rem; }
  .fm-card__name { font-weight: 600; font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .fm-card__meta { font-size: 0.66rem; color: var(--color-ink-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .fm-del { font: inherit; font-size: 0.72rem; background: transparent; border: 1px solid var(--color-line-strong); color: var(--color-ink-soft); border-radius: 7px; padding: 0.25rem 0.6rem; cursor: pointer; margin-top: 0.2rem; }
  .fm-del:hover { border-color: #e9b8b8; color: #9b2c2c; }
</style>

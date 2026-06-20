<!--
  Invoice surface — explains and demonstrates what the module does (build a draft,
  issue it with a gapless atomic number, then collect payment). Built on the shared
  DS; presentational (host supplies the draft lines / issued invoices + handlers).
  Live money math uses the module's real computeTotals (per-line tax rounding), so
  the printed totals reconcile line-by-line exactly as the backend computes them.
  Reused by the module-preview harness and template routes.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";
  import { computeTotals } from "@microservices-sh/invoice/totals";

  type DraftLine = { id: string; description: string; quantity: number; unitAmountCents: number; taxRateBps: number };
  type IssuedInvoice = {
    number: string;
    customerName: string;
    status: "open" | "paid" | "void";
    currency: string;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    lineCount: number;
  };

  let {
    series = "INV",
    currency = "USD",
    customerName = "Northwind Traders",
    draftLines = [],
    invoices = [],
    busy = false,
    onaddline,
    onremoveline,
    onissue,
    onpay,
    onvoid
  }: {
    series?: string;
    currency?: string;
    customerName?: string;
    draftLines?: DraftLine[];
    invoices?: IssuedInvoice[];
    busy?: boolean;
    onaddline?: (l: { description: string; quantity: number; unitAmountCents: number; taxRateBps: number }) => void;
    onremoveline?: (id: string) => void;
    onissue?: () => void;
    onpay?: (number: string) => void;
    onvoid?: (number: string) => void;
  } = $props();

  let description = $state("Implementation — Phase 1");
  let quantity = $state(10);
  let unit = $state(150); // dollars, converted to cents on add
  let taxPct = $state(8.75);

  const money = (c: number, cur = currency) => new Intl.NumberFormat("en", { style: "currency", currency: cur || "USD" }).format((c || 0) / 100);

  const totals = $derived(computeTotals(draftLines));

  function addLine(e: Event) {
    e.preventDefault();
    if (!description.trim() || quantity <= 0 || unit <= 0) return;
    onaddline?.({
      description: description.trim(),
      quantity: Math.round(quantity),
      unitAmountCents: Math.round(unit * 100),
      taxRateBps: Math.round(taxPct * 100)
    });
  }
</script>

<header class="inv-head">
  <Eyebrow>Invoicing</Eyebrow>
  <h1 class="inv-title">Invoice</h1>
  <p class="inv-lede">Build a draft, then <strong>issue</strong> it — issuing assigns a <strong>gapless atomic number</strong>, freezes the document, and emits an event. Edits are only allowed while a draft; an issued invoice is immutable.</p>
  <ol class="inv-how">
    <li><span class="inv-how__n mono">01</span><span><strong>Draft</strong> — add line items; per-line tax is rounded line-by-line so totals reconcile.</span></li>
    <li><span class="inv-how__n mono">02</span><span><strong>Issue</strong> — assigns the next <code>{series}-####</code> number (gapless), freezes it, emits <code>invoice.issued</code>.</span></li>
    <li><span class="inv-how__n mono">03</span><span><strong>Settle</strong> — record a payment → <code>invoice.paid</code>; or void → <code>invoice.voided</code>.</span></li>
  </ol>
</header>

<section class="inv-console" aria-label="Build a draft invoice">
  <div class="inv-console__rail" aria-hidden="true"></div>

  <div class="inv-draft-head">
    <p class="inv-label">Draft <em>· {customerName}</em></p>
    <span class="inv-status inv-status--draft">draft</span>
  </div>

  {#if draftLines.length}
    <ul class="inv-lines">
      {#each draftLines as l (l.id)}
        <li class="inv-line">
          <span class="inv-line__desc">{l.description}</span>
          <span class="inv-line__meta mono">{l.quantity} × {money(l.unitAmountCents)} · {(l.taxRateBps / 100).toFixed(2)}% tax</span>
          <span class="inv-line__amt mono">{money(l.quantity * l.unitAmountCents)}</span>
          <button type="button" class="inv-line__rm" aria-label="Remove line" onclick={() => onremoveline?.(l.id)}>×</button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="inv-empty">No lines yet — add one below.</p>
  {/if}

  <form class="inv-add" onsubmit={addLine}>
    <label class="inv-f inv-f--desc"><span>Description</span><input bind:value={description} /></label>
    <label class="inv-f inv-f--num"><span>Qty</span><input type="number" min="1" bind:value={quantity} /></label>
    <label class="inv-f inv-f--num"><span>Unit $</span><input type="number" min="0" step="0.01" bind:value={unit} /></label>
    <label class="inv-f inv-f--num"><span>Tax %</span><input type="number" min="0" step="0.01" bind:value={taxPct} /></label>
    <Button type="submit" variant="ghost">+ Add line</Button>
  </form>

  <div class="inv-totals">
    <div class="inv-tot"><span>Subtotal</span><span class="mono">{money(totals.subtotalCents)}</span></div>
    <div class="inv-tot"><span>Tax</span><span class="mono">{money(totals.taxCents)}</span></div>
    <div class="inv-tot inv-tot--grand"><span>Total</span><span class="mono">{money(totals.totalCents)}</span></div>
  </div>

  <div class="inv-actions">
    <Button variant="primary" disabled={!draftLines.length || busy} onclick={() => onissue?.()}>{busy ? "Issuing…" : "Issue invoice →"}</Button>
    <span class="inv-hint">Next number: <span class="mono">{series}-{String(invoices.length + 1).padStart(4, "0")}</span></span>
  </div>
</section>

<div class="inv-out">
  <p class="inv-out__h mono">Issued <span>({invoices.length})</span></p>
  {#if invoices.length}
    <ul class="inv-issued">
      {#each invoices as inv (inv.number)}
        <li class="inv-card" class:void={inv.status === "void"}>
          <div class="inv-card__main">
            <span class="inv-card__num mono">{inv.number}</span>
            <span class="inv-card__who">{inv.customerName} · {inv.lineCount} {inv.lineCount === 1 ? "line" : "lines"}</span>
          </div>
          <span class="inv-card__amt mono">{money(inv.totalCents, inv.currency)}</span>
          <span class="inv-pill inv-pill--{inv.status}">{inv.status}</span>
          {#if inv.status === "open"}
            <span class="inv-card__act">
              <button type="button" class="inv-btn inv-btn--pay" onclick={() => onpay?.(inv.number)}>Record payment</button>
              <button type="button" class="inv-btn inv-btn--void" onclick={() => onvoid?.(inv.number)}>Void</button>
            </span>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="inv-empty">Issue the draft above to see a numbered invoice.</p>
  {/if}
</div>

<style>
  .inv-head { margin-bottom: 1.5rem; }
  .inv-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .inv-lede { color: var(--color-ink-soft); max-width: 62ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .inv-lede strong { color: var(--color-ink); font-weight: 600; }
  .inv-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 68ch; }
  .inv-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .inv-how strong { color: var(--color-ink); font-weight: 600; }
  .inv-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .inv-how__n { color: var(--color-green); font-size: 0.72rem; }

  .inv-console { position: relative; border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1.2rem 1.3rem 1.2rem 1.5rem; overflow: hidden; }
  .inv-console__rail { position: absolute; inset: 0 auto 0 0; width: 3px; background: linear-gradient(180deg, var(--color-green), transparent); opacity: 0.7; }
  .inv-draft-head { display: flex; align-items: center; justify-content: space-between; gap: 0.7rem; margin-bottom: 0.6rem; }
  .inv-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; margin: 0; }
  .inv-label em { font-style: normal; opacity: 0.7; text-transform: none; letter-spacing: 0; }

  .inv-lines { list-style: none; margin: 0 0 0.6rem; padding: 0; display: grid; gap: 0.35rem; }
  .inv-line { display: grid; grid-template-columns: 1fr auto auto auto; align-items: center; gap: 0.8rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 9px; padding: 0.5rem 0.7rem; }
  .inv-line__desc { font-weight: 600; font-size: 0.88rem; }
  .inv-line__meta { font-size: 0.72rem; color: var(--color-ink-faint); }
  .inv-line__amt { font-size: 0.84rem; color: var(--color-ink); }
  .inv-line__rm { font: inherit; font-size: 1.1rem; line-height: 1; background: transparent; border: none; color: var(--color-ink-faint); cursor: pointer; padding: 0 0.2rem; }
  .inv-line__rm:hover { color: #9b2c2c; }

  .inv-add { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: end; margin: 0.8rem 0; }
  .inv-f { display: grid; gap: 0.25rem; }
  .inv-f--desc { flex: 1 1 200px; }
  .inv-f--num { flex: 0 0 80px; }
  .inv-f span { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-faint); font-weight: 600; }
  .inv-f input { width: 100%; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.5rem 0.65rem; font: inherit; font-size: 0.88rem; }
  .inv-f input:focus { outline: none; border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }

  .inv-totals { display: grid; gap: 0.25rem; margin: 0.4rem 0 0.9rem; padding-top: 0.7rem; border-top: 1px dashed var(--color-line-strong); max-width: 260px; margin-left: auto; }
  .inv-tot { display: flex; justify-content: space-between; gap: 1.5rem; font-size: 0.84rem; color: var(--color-ink-soft); }
  .inv-tot--grand { font-weight: 700; color: var(--color-ink); font-size: 0.98rem; padding-top: 0.3rem; border-top: 1px solid var(--color-line-strong); }

  .inv-actions { display: flex; align-items: center; gap: 0.9rem; flex-wrap: wrap; }
  .inv-hint { font-size: 0.76rem; color: var(--color-ink-faint); }
  .inv-hint .mono { color: var(--color-green); }

  .inv-out { margin-top: 1.6rem; }
  .inv-out__h { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-ink-faint); margin: 0 0 0.6rem; }
  .inv-empty { color: var(--color-ink-faint); font-size: 0.85rem; }
  .inv-status { font-family: var(--font-mono); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.18rem 0.5rem; border-radius: 999px; }
  .inv-status--draft { color: var(--color-ink-faint); background: color-mix(in srgb, var(--color-ink-faint) 14%, transparent); }

  /* white "paper" issued-invoice cards */
  .inv-issued { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
  .inv-card {
    --p-ink: #1a1f36; --p-faint: #8a93a3; --p-line: #e6ebf1;
    display: grid; grid-template-columns: 1fr auto auto auto; align-items: center; gap: 0.9rem;
    background: #ffffff; color: var(--p-ink); border: 1px solid var(--p-line); border-radius: 11px; padding: 0.7rem 0.95rem;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05), 0 16px 32px -22px rgba(16, 24, 40, 0.22);
    animation: inv-rise 0.36s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .inv-card.void { opacity: 0.6; }
  .inv-card__main { display: grid; }
  .inv-card__num { font-weight: 700; font-size: 0.9rem; }
  .inv-card__who { font-size: 0.78rem; color: var(--p-faint); }
  .inv-card__amt { font-size: 0.9rem; font-weight: 600; }
  .inv-pill { font-family: var(--font-mono); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.2rem 0.5rem; border-radius: 999px; }
  .inv-pill--open { color: #1d4ed8; background: #dbe6fe; }
  .inv-pill--paid { color: #0c8f5a; background: #d8f6e8; }
  .inv-pill--void { color: #9b2c2c; background: #fde8e8; }
  .inv-card__act { display: inline-flex; gap: 0.4rem; }
  .inv-btn { font: inherit; font-size: 0.74rem; background: transparent; border: 1px solid var(--p-line); border-radius: 7px; padding: 0.3rem 0.55rem; cursor: pointer; }
  .inv-btn--pay { color: #0c8f5a; }
  .inv-btn--pay:hover { border-color: #aee3ca; background: #f1fbf6; }
  .inv-btn--void { color: #9b2c2c; }
  .inv-btn--void:hover { border-color: #e9b8b8; background: #fff5f5; }

  @keyframes inv-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .inv-card { animation: none; } }
</style>

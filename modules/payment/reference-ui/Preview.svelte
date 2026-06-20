<!--
  Payment surface — explains and demonstrates what the module does (create a
  gateway-agnostic payment intent, confirm it from a verified webhook, and refund
  it). Built on the shared DS; the payments list + handlers are host-supplied. The
  point shown here: the charge is only ever advanced by a verified webhook, never
  optimistically — pending stays pending until succeeded/failed arrives. Reused by
  the harness and template routes.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type Status = "pending" | "succeeded" | "refunded" | "failed";
  type Payment = { id: string; intentId: string; customerId: string; amount: number; currency: string; status: Status; description: string | null; createdAt: string };

  let {
    payments = [],
    busy = false,
    oncreate,
    onwebhook,
    onrefund
  }: {
    payments?: Payment[];
    busy?: boolean;
    oncreate?: (input: { amount: number; customerId: string; description: string | null }) => void;
    onwebhook?: (id: string, outcome: "succeeded" | "failed") => void;
    onrefund?: (id: string) => void;
  } = $props();

  let amount = $state(49);
  let customerId = $state("cus_ada");
  let description = $state("Pro plan — May");

  const money = (c: number, cur = "USD") => new Intl.NumberFormat("en", { style: "currency", currency: cur || "USD" }).format((c || 0) / 100);
  const when = (iso: string) => new Date(iso).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const STATUS: Record<Status, { tint: string; event: string }> = {
    pending:   { tint: "#f59e0b", event: "payment.checkout_created" },
    succeeded: { tint: "#0c8f5a", event: "payment.succeeded" },
    refunded:  { tint: "#6366f1", event: "payment.refunded" },
    failed:    { tint: "#ef4444", event: "payment.failed" }
  };

  function create(e: Event) {
    e.preventDefault();
    if (amount <= 0 || !customerId.trim()) return;
    oncreate?.({ amount: Math.round(amount * 100), customerId: customerId.trim(), description: description.trim() || null });
  }
</script>

<header class="pm-head">
  <Eyebrow>Payments</Eyebrow>
  <h1 class="pm-title">Payment</h1>
  <p class="pm-lede">Create a <strong>gateway-agnostic intent</strong>, then advance it <strong>only from a verified webhook</strong> — never optimistically. A charge stays <code>pending</code> until <code>succeeded</code> or <code>failed</code> actually arrives, so your records always match the gateway.</p>
  <ol class="pm-how">
    <li><span class="pm-how__n mono">01</span><span><strong>Create intent</strong> — amount + customer; emits <code>payment.checkout_created</code>.</span></li>
    <li><span class="pm-how__n mono">02</span><span><strong>Confirm</strong> — a signature-verified webhook moves it to <code>succeeded</code> or <code>failed</code>.</span></li>
    <li><span class="pm-how__n mono">03</span><span><strong>Refund</strong> — a succeeded charge can be refunded; emits <code>payment.refunded</code>.</span></li>
  </ol>
</header>

<section class="pm-console" aria-label="Create a charge">
  <div class="pm-console__rail" aria-hidden="true"></div>
  <p class="pm-label">New charge</p>
  <form class="pm-form" onsubmit={create}>
    <label class="pm-f pm-f--amt"><span>Amount $</span><input type="number" min="0" step="0.01" bind:value={amount} /></label>
    <label class="pm-f"><span>Customer</span><input bind:value={customerId} /></label>
    <label class="pm-f pm-f--desc"><span>Description</span><input bind:value={description} /></label>
    <Button type="submit" variant="primary">{busy ? "Creating…" : "Create intent →"}</Button>
  </form>
</section>

<div class="pm-out">
  <p class="pm-out__h mono">Payments <span>({payments.length})</span></p>
  {#if payments.length}
    <ul class="pm-list">
      {#each payments as p (p.id)}
        <li class="pm-card" class:refunded={p.status === "refunded"} class:failed={p.status === "failed"}>
          <div class="pm-card__main">
            <span class="pm-card__amt">{money(p.amount, p.currency)}</span>
            <span class="pm-card__who">{p.customerId}{#if p.description} · {p.description}{/if}</span>
            <span class="pm-card__intent mono">{p.intentId}</span>
          </div>
          <span class="pm-card__side">
            <span class="pm-pill" style={`--tint:${STATUS[p.status].tint}`}>{p.status}</span>
            <span class="pm-card__when mono">{when(p.createdAt)}</span>
          </span>
          <span class="pm-card__act">
            {#if p.status === "pending"}
              <button type="button" class="pm-btn pm-btn--ok" onclick={() => onwebhook?.(p.id, "succeeded")}>webhook: succeeded</button>
              <button type="button" class="pm-btn pm-btn--bad" onclick={() => onwebhook?.(p.id, "failed")}>failed</button>
            {:else if p.status === "succeeded"}
              <button type="button" class="pm-btn" onclick={() => onrefund?.(p.id)}>Refund</button>
            {/if}
          </span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="pm-empty">Create an intent above to start a charge.</p>
  {/if}
</div>

<style>
  .pm-head { margin-bottom: 1.5rem; }
  .pm-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .pm-lede { color: var(--color-ink-soft); max-width: 64ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .pm-lede strong { color: var(--color-ink); font-weight: 600; }
  .pm-lede code, .pm-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .pm-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 70ch; }
  .pm-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .pm-how strong { color: var(--color-ink); font-weight: 600; }
  .pm-how__n { color: var(--color-green); font-size: 0.72rem; }

  .pm-console { position: relative; border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1.1rem 1.2rem 1.2rem 1.4rem; overflow: hidden; }
  .pm-console__rail { position: absolute; inset: 0 auto 0 0; width: 3px; background: linear-gradient(180deg, var(--color-green), transparent); opacity: 0.7; }
  .pm-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; margin: 0 0 0.7rem; }
  .pm-form { display: flex; flex-wrap: wrap; gap: 0.7rem; align-items: end; }
  .pm-f { display: grid; gap: 0.25rem; flex: 1 1 130px; }
  .pm-f--amt { flex: 0 0 110px; }
  .pm-f--desc { flex: 2 1 200px; }
  .pm-f span { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-faint); font-weight: 600; }
  .pm-f input { width: 100%; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.5rem 0.65rem; font: inherit; font-size: 0.88rem; }
  .pm-f input:focus { outline: none; border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }

  .pm-out { margin-top: 1.6rem; }
  .pm-out__h { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-ink-faint); margin: 0 0 0.6rem; }
  .pm-empty { color: var(--color-ink-faint); font-size: 0.85rem; }

  /* white "paper" payment cards */
  .pm-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
  .pm-card {
    --p-ink: #1a1f36; --p-faint: #8a93a3; --p-line: #e6ebf1;
    display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 0.9rem;
    background: #ffffff; color: var(--p-ink); border: 1px solid var(--p-line); border-radius: 11px; padding: 0.7rem 0.95rem;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05), 0 16px 32px -22px rgba(16, 24, 40, 0.22);
    animation: pm-rise 0.36s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .pm-card.refunded, .pm-card.failed { opacity: 0.7; }
  .pm-card__main { display: grid; gap: 0.1rem; min-width: 0; }
  .pm-card__amt { font-weight: 700; font-size: 0.98rem; }
  .pm-card__who { font-size: 0.78rem; color: var(--p-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pm-card__intent { font-size: 0.68rem; color: var(--p-faint); }
  .pm-card__side { display: grid; justify-items: end; gap: 0.25rem; }
  .pm-card__when { font-size: 0.7rem; color: var(--p-faint); }
  .pm-pill { font-family: var(--font-mono); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.2rem 0.5rem; border-radius: 999px; color: var(--tint); background: color-mix(in srgb, var(--tint) 15%, white); }
  .pm-card__act { display: inline-flex; gap: 0.4rem; flex-wrap: wrap; justify-content: flex-end; }
  .pm-btn { font: inherit; font-size: 0.72rem; background: transparent; border: 1px solid var(--p-line); color: var(--p-ink); border-radius: 7px; padding: 0.3rem 0.55rem; cursor: pointer; }
  .pm-btn:hover { border-color: #c9d2dc; background: #f7f9fb; }
  .pm-btn--ok { color: #0c8f5a; }
  .pm-btn--ok:hover { border-color: #aee3ca; background: #f1fbf6; }
  .pm-btn--bad { color: #9b2c2c; }
  .pm-btn--bad:hover { border-color: #e9b8b8; background: #fff5f5; }

  @keyframes pm-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .pm-card { animation: none; } }
</style>

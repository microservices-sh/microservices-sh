<!--
  Billing & Subscriptions surface — explains and demonstrates what the module does
  (model a subscription across the FULL set of Stripe statuses and gate access on
  it). Built on the shared DS; plans + the subscription + handlers are host-supplied.
  The point shown here: status is not just active/canceled — past_due, unpaid,
  paused and trialing each change whether access is granted, so a webhook can't
  over- or under-provision. Reused by the harness and template routes.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type Interval = "month" | "year";
  type Status = "trialing" | "active" | "past_due" | "unpaid" | "paused" | "canceled";
  type Plan = { id: string; name: string; priceCents: number; currency: string; interval: Interval; features: string[] };
  type Subscription = { planId: string; status: Status; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean };

  let {
    plans = [],
    subscription = null,
    busy = false,
    onstart,
    onchangeplan,
    onstatus,
    oncancelatperiodend
  }: {
    plans?: Plan[];
    subscription?: Subscription | null;
    busy?: boolean;
    onstart?: (planId: string) => void;
    onchangeplan?: (planId: string) => void;
    onstatus?: (status: Status) => void;
    oncancelatperiodend?: () => void;
  } = $props();

  const money = (c: number, cur = "USD") => new Intl.NumberFormat("en", { style: "currency", currency: cur || "USD", maximumFractionDigits: 0 }).format((c || 0) / 100);
  const plan = $derived(subscription ? plans.find((p) => p.id === subscription.planId) ?? null : null);

  // Status drives access — the whole reason for modeling every state.
  const STATUS: Record<Status, { label: string; tint: string; access: "granted" | "grace" | "revoked"; event?: string }> = {
    trialing:  { label: "Trialing",  tint: "#8b5cf6", access: "granted", event: "subscription.started" },
    active:    { label: "Active",    tint: "#0c8f5a", access: "granted", event: "subscription.activated" },
    past_due:  { label: "Past due",  tint: "#f59e0b", access: "grace",   event: "subscription.past_due" },
    unpaid:    { label: "Unpaid",    tint: "#ef4444", access: "revoked" },
    paused:    { label: "Paused",    tint: "#64748b", access: "revoked" },
    canceled:  { label: "Canceled",  tint: "#57606a", access: "revoked", event: "subscription.canceled" }
  };
  const ACCESS = { granted: { txt: "Access granted", tint: "#0c8f5a" }, grace: { txt: "Access · grace period", tint: "#f59e0b" }, revoked: { txt: "Access revoked", tint: "#ef4444" } };

  // Webhook-driven transitions the host applies via applyStripeEvent.
  const TRANSITIONS: { label: string; to: Status }[] = [
    { label: "Payment succeeded", to: "active" },
    { label: "Payment failed", to: "past_due" },
    { label: "Dunning exhausted", to: "unpaid" },
    { label: "Pause", to: "paused" }
  ];

  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "—");
</script>

<header class="bs-head">
  <Eyebrow>Billing &amp; subscriptions</Eyebrow>
  <h1 class="bs-title">Billing &amp; Subscriptions</h1>
  <p class="bs-lede">Model a subscription across <strong>every Stripe status</strong> — not just active/canceled — and <strong>gate access</strong> on it. <code>past_due</code>, <code>unpaid</code>, <code>paused</code> and <code>trialing</code> each decide whether the customer keeps access, so a webhook can't over- or under-provision.</p>
  <ol class="bs-how">
    <li><span class="bs-how__n mono">01</span><span><strong>Start</strong> — subscribe to a plan; emits <code>subscription.started</code>.</span></li>
    <li><span class="bs-how__n mono">02</span><span><strong>React to Stripe</strong> — normalized webhooks move status; each emits a lifecycle event.</span></li>
    <li><span class="bs-how__n mono">03</span><span><strong>Gate access</strong> — derived from status, so provisioning always matches billing reality.</span></li>
  </ol>
</header>

<section class="bs-plans" aria-label="Plans">
  {#each plans as p (p.id)}
    <div class="bs-plan" class:on={plan?.id === p.id}>
      <p class="bs-plan__name">{p.name}</p>
      <p class="bs-plan__price"><span class="bs-plan__amt">{money(p.priceCents, p.currency)}</span><span class="bs-plan__per">/{p.interval}</span></p>
      <ul class="bs-plan__features">
        {#each p.features as f}<li>{f}</li>{/each}
      </ul>
      {#if !subscription}
        <Button variant="primary" disabled={busy} onclick={() => onstart?.(p.id)}>Start</Button>
      {:else if plan?.id === p.id}
        <span class="bs-plan__current mono">current plan</span>
      {:else}
        <Button variant="ghost" disabled={busy} onclick={() => onchangeplan?.(p.id)}>Switch</Button>
      {/if}
    </div>
  {/each}
</section>

{#if subscription && plan}
  {@const s = STATUS[subscription.status]}
  {@const acc = ACCESS[s.access]}
  <section class="bs-sub" aria-label="Subscription">
    <div class="bs-sub__top">
      <div>
        <p class="bs-label">Subscription</p>
        <p class="bs-sub__plan">{plan.name} · <span class="mono">{money(plan.priceCents, plan.currency)}/{plan.interval}</span></p>
        <p class="bs-sub__period">renews {when(subscription.currentPeriodEnd)}{#if subscription.cancelAtPeriodEnd} · <em>cancels at period end</em>{/if}</p>
      </div>
      <div class="bs-sub__badges">
        <span class="bs-status" style={`--tint:${s.tint}`}>{s.label}</span>
        <span class="bs-access" style={`--tint:${acc.tint}`}><span class="bs-access__dot"></span>{acc.txt}</span>
      </div>
    </div>

    <p class="bs-flabel">Simulate a Stripe webhook <em>· applyStripeEvent</em></p>
    <div class="bs-trans">
      {#each TRANSITIONS as t}
        <button type="button" class="bs-trans__b" disabled={busy || subscription.status === t.to} onclick={() => onstatus?.(t.to)}>{t.label}</button>
      {/each}
      {#if !subscription.cancelAtPeriodEnd && subscription.status !== "canceled"}
        <button type="button" class="bs-trans__b bs-trans__b--warn" disabled={busy} onclick={() => oncancelatperiodend?.()}>Cancel at period end</button>
      {/if}
      <button type="button" class="bs-trans__b bs-trans__b--warn" disabled={busy || subscription.status === "canceled"} onclick={() => onstatus?.("canceled")}>End now</button>
    </div>
    {#if s.event}<p class="bs-evt mono">last transition emitted <span>{s.event}</span></p>{/if}
  </section>
{/if}

<style>
  .bs-head { margin-bottom: 1.5rem; }
  .bs-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .bs-lede { color: var(--color-ink-soft); max-width: 66ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .bs-lede strong { color: var(--color-ink); font-weight: 600; }
  .bs-lede code, .bs-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .bs-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 70ch; }
  .bs-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .bs-how strong { color: var(--color-ink); font-weight: 600; }
  .bs-how__n { color: var(--color-green); font-size: 0.72rem; }

  .bs-plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.7rem; margin-bottom: 1rem; }
  .bs-plan { border: 1px solid var(--color-line-strong); border-radius: 12px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1rem; display: grid; gap: 0.5rem; align-content: start; }
  .bs-plan.on { border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 14%, transparent); }
  .bs-plan__name { font-weight: 700; font-size: 0.95rem; margin: 0; }
  .bs-plan__price { margin: 0; display: flex; align-items: baseline; gap: 0.2rem; }
  .bs-plan__amt { font-family: var(--font-display); font-weight: 800; font-size: 1.4rem; }
  .bs-plan__per { font-size: 0.78rem; color: var(--color-ink-faint); }
  .bs-plan__features { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.2rem; }
  .bs-plan__features li { font-size: 0.78rem; color: var(--color-ink-soft); padding-left: 1rem; position: relative; }
  .bs-plan__features li::before { content: "✓"; position: absolute; left: 0; color: var(--color-green); font-size: 0.8rem; }
  .bs-plan__current { font-size: 0.72rem; color: var(--color-green); text-transform: uppercase; letter-spacing: 0.05em; }

  .bs-sub { border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1.1rem 1.2rem; }
  .bs-sub__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
  .bs-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; margin: 0 0 0.3rem; }
  .bs-sub__plan { margin: 0; font-weight: 600; font-size: 0.98rem; }
  .bs-sub__period { margin: 0.15rem 0 0; font-size: 0.8rem; color: var(--color-ink-faint); }
  .bs-sub__period em { font-style: normal; color: #f59e0b; }
  .bs-sub__badges { display: grid; gap: 0.4rem; justify-items: end; }
  .bs-status { font-family: var(--font-mono); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.25rem 0.6rem; border-radius: 999px; color: var(--tint); background: color-mix(in srgb, var(--tint) 14%, transparent); border: 1px solid color-mix(in srgb, var(--tint) 32%, transparent); }
  .bs-access { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem; font-weight: 600; color: var(--tint); }
  .bs-access__dot { width: 8px; height: 8px; border-radius: 999px; background: var(--tint); }

  .bs-flabel { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-faint); font-weight: 600; margin: 1rem 0 0.5rem; }
  .bs-flabel em { font-style: normal; opacity: 0.7; text-transform: none; letter-spacing: 0; }
  .bs-trans { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .bs-trans__b { font: inherit; font-size: 0.78rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink-soft); border-radius: 8px; padding: 0.4rem 0.65rem; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
  .bs-trans__b:hover:not(:disabled) { border-color: var(--color-green); color: var(--color-green); }
  .bs-trans__b:disabled { opacity: 0.4; cursor: default; }
  .bs-trans__b--warn:hover:not(:disabled) { border-color: #e9b8b8; color: #9b2c2c; }
  .bs-evt { font-size: 0.74rem; color: var(--color-ink-faint); margin: 0.6rem 0 0; }
  .bs-evt span { color: var(--color-green); }
</style>

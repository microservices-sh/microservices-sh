<!--
  Booking surface — explains and demonstrates what the module does (let customers
  book a service at an available time, recorded + emitted as events). Built on the
  shared DS; presentational (host supplies services/availability/bookings + handlers).
  Reused by the module-preview harness and template routes.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type Service = { id: string; name: string; description?: string; durationMinutes: number; priceCents: number; currency: string };
  type Slot = { serviceId: string; startsAt: string; endsAt: string; available: boolean };
  type Booking = { id: string; serviceName: string; customerName: string; startsAt: string; status: "confirmed" | "cancelled" };

  let {
    services = [],
    availability = [],
    bookings = [],
    busy = false,
    onbook,
    oncancel
  }: { services?: Service[]; availability?: Slot[]; bookings?: Booking[]; busy?: boolean; onbook?: (b: any) => void; oncancel?: (id: string) => void } = $props();

  let serviceId = $state("");
  let slotIso = $state("");
  let name = $state("Ada Lovelace");
  let email = $state("ada@example.com");

  $effect(() => {
    if (!serviceId && services.length) serviceId = services[0].id;
  });
  const service = $derived(services.find((s) => s.id === serviceId));
  const slots = $derived(availability.filter((a) => a.serviceId === serviceId && a.available));

  const money = (c: number, cur: string) => new Intl.NumberFormat("en", { style: "currency", currency: cur || "USD" }).format((c || 0) / 100);
  const when = (iso: string) => new Date(iso).toLocaleString("en", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  function book(e: Event) {
    e.preventDefault();
    const slot = slots.find((s) => s.startsAt === slotIso);
    if (!service || !slot) return;
    onbook?.({ serviceId, serviceName: service.name, startsAt: slot.startsAt, endsAt: slot.endsAt, customerName: name, customerEmail: email });
    slotIso = "";
  }
</script>

<header class="bk-head">
  <Eyebrow>Service booking</Eyebrow>
  <h1 class="bk-title">Booking</h1>
  <p class="bk-lede">Let customers book a service at an available time — each booking is <strong>recorded</strong>, <strong>confirmed</strong>, and <strong>emitted as an event</strong> the rest of your app can react to.</p>
  <ol class="bk-how">
    <li><span class="bk-how__n mono">01</span><span><strong>Define services</strong> — name, duration, price.</span></li>
    <li><span class="bk-how__n mono">02</span><span><strong>Compute availability</strong> — open time slots per service (no double-booking).</span></li>
    <li><span class="bk-how__n mono">03</span><span><strong>Book a slot</strong> — records a booking and emits <code>booking.created</code> + <code>booking.confirmed</code>; cancelling emits <code>booking.cancelled</code>.</span></li>
  </ol>
</header>

<section class="bk-console" aria-label="Book a service">
  <div class="bk-console__rail" aria-hidden="true"></div>
  <form class="bk-form" onsubmit={book}>
    <p class="bk-label">Service</p>
    <div class="bk-services">
      {#each services as s}
        <button type="button" class="bk-svc" class:on={s.id === serviceId} onclick={() => { serviceId = s.id; slotIso = ""; }}>
          <span class="bk-svc__name">{s.name}</span>
          <span class="bk-svc__meta mono">{s.durationMinutes}m · {money(s.priceCents, s.currency)}</span>
        </button>
      {/each}
    </div>

    <p class="bk-label">Available times {#if service}<em>· {service.name}</em>{/if}</p>
    <div class="bk-slots">
      {#each slots as sl}
        <button type="button" class="bk-slot" class:on={sl.startsAt === slotIso} onclick={() => (slotIso = sl.startsAt)}>{when(sl.startsAt)}</button>
      {:else}
        <span class="bk-empty">no open slots</span>
      {/each}
    </div>

    <div class="bk-guest">
      <label class="bk-f"><span>Name</span><input bind:value={name} /></label>
      <label class="bk-f"><span>Email</span><input bind:value={email} type="email" /></label>
      <Button type="submit" variant="primary">{busy ? "Booking…" : "Book →"}</Button>
    </div>
  </form>
</section>

<div class="bk-out">
  <p class="bk-out__h mono">Bookings <span>({bookings.length})</span></p>
  {#if bookings.length}
    <ul class="bk-bookings">
      {#each bookings as b (b.id)}
        <li class="bk-card" class:cancelled={b.status === "cancelled"}>
          <div class="bk-card__main">
            <span class="bk-card__svc">{b.serviceName}</span>
            <span class="bk-card__who">{b.customerName}</span>
          </div>
          <span class="bk-card__when mono">{when(b.startsAt)}</span>
          <span class="bk-status bk-status--{b.status}">{b.status}</span>
          {#if b.status === "confirmed"}<button type="button" class="bk-cancel" onclick={() => oncancel?.(b.id)}>Cancel</button>{/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="bk-empty">Book a slot above to create a booking.</p>
  {/if}
</div>

<style>
  .bk-head { margin-bottom: 1.5rem; }
  .bk-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .bk-lede { color: var(--color-ink-soft); max-width: 60ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .bk-lede strong { color: var(--color-ink); font-weight: 600; }
  .bk-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 66ch; }
  .bk-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .bk-how strong { color: var(--color-ink); font-weight: 600; }
  .bk-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .bk-how__n { color: var(--color-green); font-size: 0.72rem; }

  .bk-console { position: relative; border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1.2rem 1.3rem 1.2rem 1.5rem; overflow: hidden; }
  .bk-console__rail { position: absolute; inset: 0 auto 0 0; width: 3px; background: linear-gradient(180deg, var(--color-green), transparent); opacity: 0.7; }
  .bk-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; margin: 0 0 0.5rem; }
  .bk-label em { font-style: normal; opacity: 0.7; text-transform: none; letter-spacing: 0; }
  .bk-label:not(:first-child) { margin-top: 1.1rem; }

  .bk-services { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .bk-svc { display: grid; gap: 0.15rem; text-align: left; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 10px; padding: 0.55rem 0.8rem; cursor: pointer; color: var(--color-ink); transition: border-color 0.15s, transform 0.15s; }
  .bk-svc:hover { transform: translateY(-1px); }
  .bk-svc.on { border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }
  .bk-svc__name { font-weight: 600; font-size: 0.9rem; }
  .bk-svc__meta { font-size: 0.72rem; color: var(--color-ink-faint); }

  .bk-slots { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .bk-slot { font-family: var(--font-mono); font-size: 0.78rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 8px; padding: 0.4rem 0.6rem; cursor: pointer; color: var(--color-ink-soft); transition: border-color 0.15s; }
  .bk-slot:hover { border-color: color-mix(in srgb, var(--color-green) 40%, var(--color-line-strong)); }
  .bk-slot.on { border-color: var(--color-green); color: var(--color-green); background: color-mix(in srgb, var(--color-green) 8%, var(--color-paper)); }

  .bk-guest { display: flex; gap: 0.7rem; align-items: end; flex-wrap: wrap; margin-top: 1.1rem; }
  .bk-f { display: grid; gap: 0.25rem; flex: 1 1 180px; }
  .bk-f span { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-faint); font-weight: 600; }
  .bk-f input { width: 100%; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.5rem 0.65rem; font: inherit; font-size: 0.88rem; }
  .bk-f input:focus { outline: none; border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }

  .bk-out { margin-top: 1.6rem; }
  .bk-out__h { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-ink-faint); margin: 0 0 0.6rem; }
  .bk-empty { color: var(--color-ink-faint); font-size: 0.85rem; }

  /* white "paper" booking cards */
  .bk-bookings { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
  .bk-card {
    --p-ink: #1a1f36; --p-faint: #8a93a3; --p-line: #e6ebf1;
    display: grid; grid-template-columns: 1fr auto auto auto; align-items: center; gap: 0.9rem;
    background: #ffffff; color: var(--p-ink); border: 1px solid var(--p-line); border-radius: 11px; padding: 0.7rem 0.95rem;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05), 0 16px 32px -22px rgba(16, 24, 40, 0.22);
    animation: bk-rise 0.36s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .bk-card.cancelled { opacity: 0.6; }
  .bk-card__main { display: grid; }
  .bk-card__svc { font-weight: 600; font-size: 0.92rem; }
  .bk-card__who { font-size: 0.78rem; color: var(--p-faint); }
  .bk-card__when { font-size: 0.76rem; color: var(--p-faint); }
  .bk-status { font-family: var(--font-mono); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.2rem 0.5rem; border-radius: 999px; }
  .bk-status--confirmed { color: #0c8f5a; background: #d8f6e8; }
  .bk-status--cancelled { color: #9b2c2c; background: #fde8e8; }
  .bk-cancel { font: inherit; font-size: 0.76rem; background: transparent; border: 1px solid var(--p-line); color: #9b2c2c; border-radius: 7px; padding: 0.3rem 0.6rem; cursor: pointer; }
  .bk-cancel:hover { border-color: #e9b8b8; background: #fff5f5; }

  @keyframes bk-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .bk-card { animation: none; } }
</style>

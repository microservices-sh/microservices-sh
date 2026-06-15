<script lang="ts">
  import { statusPillClass } from "$lib/status";
  import Icon from "$lib/components/Icon.svelte";
  let { data } = $props();

  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat("en", { weekday: "short", timeZone: data.timezone }).format(new Date(`${d}T12:00:00Z`));
  const dayNum = (d: string) =>
    new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: data.timezone }).format(
      new Date(`${d}T12:00:00Z`),
    );
  const time = (iso: string) =>
    new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone: data.timezone }).format(new Date(iso));
</script>

<main class="section">
  <div class="cal-head">
    <div>
      <p class="eyebrow"><Icon name="calendar" /> Admin</p>
      <h1>Calendar.</h1>
    </div>
    <nav class="cal-nav" aria-label="Week navigation">
      <a class="button secondary" href={`/admin/calendar?start=${data.prev}`} aria-label="Previous week"><Icon name="chevron-left" /></a>
      <a class="button secondary" href="/admin/calendar">This week</a>
      <a class="button secondary" href={`/admin/calendar?start=${data.next}`} aria-label="Next week"><Icon name="chevron-right" /></a>
    </nav>
  </div>
  <p class="cal-tz">Times shown in {data.timezone}</p>

  <div class="cal-grid">
    {#each data.days as day}
      <section class="cal-day">
        <header class="cal-day__head">
          <span class="cal-day__dow">{dayLabel(day)}</span>
          <span class="cal-day__num">{dayNum(day)}</span>
        </header>
        {#if data.byDay[day].length === 0}
          <p class="cal-empty">—</p>
        {:else}
          {#each data.byDay[day] as b}
            <a class="cal-event" href={`/admin/bookings/${b.id}`}>
              <span class="cal-event__time"><Icon name="clock" size={13} /> {time(b.startsAt)}</span>
              <span class="cal-event__who">{b.customerName}</span>
              <span class="cal-event__svc">{b.serviceName}</span>
              <span class={statusPillClass(b.status)}>{b.status}</span>
            </a>
          {/each}
        {/if}
      </section>
    {/each}
  </div>

  <p style="margin-top:1.5rem"><a class="button secondary" href="/admin"><Icon name="chevron-left" /> Overview</a></p>
</main>

<style>
  .cal-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .cal-nav {
    display: flex;
    gap: 0.5rem;
  }
  .cal-tz {
    color: var(--color-muted);
    font-size: 0.85rem;
    margin: 0.5rem 0 1.25rem;
  }
  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0.6rem;
  }
  .cal-day {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    padding: 0.6rem;
    min-height: 8rem;
    background: var(--color-surface);
  }
  .cal-day__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    padding-bottom: 0.4rem;
    border-bottom: 1px solid var(--color-line);
  }
  .cal-day__dow {
    font-weight: 600;
  }
  .cal-day__num {
    color: var(--color-muted);
    font-size: 0.8rem;
  }
  .cal-empty {
    color: var(--color-line-strong);
    text-align: center;
    margin: 1rem 0;
  }
  .cal-event {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.5rem;
    margin-bottom: 0.4rem;
    border-radius: var(--radius-control);
    border: 1px solid var(--color-line);
    background: var(--color-bg);
    font-size: 0.82rem;
    transition: border-color 0.2s ease, transform 0.2s ease;
  }
  .cal-event:hover {
    border-color: var(--color-accent);
    transform: translateY(-1px);
  }
  .cal-event__time {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--color-accent);
    font-variant-numeric: tabular-nums;
  }
  .cal-event__who {
    font-weight: 600;
  }
  .cal-event__svc {
    color: var(--color-muted);
  }
  @media (max-width: 900px) {
    .cal-grid {
      grid-template-columns: 1fr;
    }
    .cal-day {
      min-height: 0;
    }
  }
</style>

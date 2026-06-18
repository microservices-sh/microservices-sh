<script lang="ts">
  import { Badge, Button, Eyebrow } from "$lib/ui";
  import { calendarEvents, focusBlocks } from "$lib/os-data";

  const weekCells = [
    { day: "Mon", date: "18", active: true },
    { day: "Tue", date: "19", active: false },
    { day: "Wed", date: "20", active: false },
    { day: "Thu", date: "21", active: false },
    { day: "Fri", date: "22", active: false }
  ];
</script>

<svelte:head>
  <title>Calendar · DOT AI OS</title>
</svelte:head>

<main class="section calendar-page">
  <div class="calendar-head">
    <div>
      <Eyebrow>Calendar</Eyebrow>
      <h1>Use calendar context without losing the plan.</h1>
      <p>
        DOT AI OS keeps Google Calendar as an optional slot: read events, pull them into the focus plan, and write back
        approved blocks only when the operator confirms.
      </p>
    </div>
    <div class="feed-card">
      <span>Feeds</span>
      <strong>dashboard.ics · tasks.ics · day-plans.ics</strong>
      <p>Private feed tokens belong in env, never in source.</p>
    </div>
  </div>

  <div class="calendar-grid">
    <section class="panel month-panel">
      <div class="section-head">
        <div>
          <Eyebrow>This week</Eyebrow>
          <h2>Planning scope</h2>
        </div>
        <Badge tone="info">calendar-google</Badge>
      </div>
      <div class="week-grid">
        {#each weekCells as cell}
          <button type="button" class:active={cell.active}>
            <span>{cell.day}</span>
            <strong>{cell.date}</strong>
          </button>
        {/each}
      </div>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <Eyebrow>Events</Eyebrow>
          <h2>Pull into work</h2>
        </div>
        <Button size="sm">Refresh</Button>
      </div>
      <div class="event-list">
        {#each calendarEvents as event}
          <article>
            <time>{event.time}</time>
            <div>
              <strong>{event.title}</strong>
              <span>{event.type}</span>
            </div>
            <Button size="sm">{event.action}</Button>
          </article>
        {/each}
      </div>
    </section>

    <section class="panel plan-panel">
      <div class="section-head">
        <div>
          <Eyebrow>Approved focus blocks</Eyebrow>
          <h2>Ready for write-back</h2>
        </div>
        <Button variant="primary" size="sm">Sync Google</Button>
      </div>
      <div class="event-list">
        {#each focusBlocks as block}
          <article>
            <time>{block.time}</time>
            <div>
              <strong>{block.title}</strong>
              <span>{block.note}</span>
            </div>
            <Badge>{block.energy}</Badge>
          </article>
        {/each}
      </div>
    </section>
  </div>
</main>

<style>
  .calendar-page,
  .calendar-head,
  .calendar-grid,
  .event-list {
    display: grid;
    gap: 18px;
  }
  .calendar-head {
    grid-template-columns: minmax(0, 1fr) minmax(260px, 360px);
    align-items: end;
  }
  .feed-card {
    display: grid;
    gap: 8px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    background: var(--color-surface);
    padding: 16px;
  }
  .feed-card span,
  .event-list span {
    color: var(--color-muted);
    font-size: 0.82rem;
  }
  .feed-card strong,
  .event-list strong {
    color: var(--color-ink);
  }
  .feed-card p {
    margin: 0;
  }
  .calendar-grid {
    grid-template-columns: minmax(260px, 0.7fr) minmax(0, 1fr);
  }
  .plan-panel {
    grid-column: 1 / -1;
  }
  .week-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
  }
  .week-grid button {
    display: grid;
    gap: 4px;
    min-block-size: 78px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-control);
    background: var(--color-surface);
    color: var(--color-ink);
    padding: 10px;
  }
  .week-grid button.active {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }
  .week-grid span {
    color: var(--color-muted);
    font-size: 0.78rem;
  }
  .event-list article {
    display: grid;
    grid-template-columns: 70px minmax(0, 1fr) max-content;
    gap: 12px;
    align-items: center;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-control);
    padding: 12px;
  }
  .event-list time {
    color: var(--color-muted);
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .event-list div {
    display: grid;
    gap: 2px;
    min-inline-size: 0;
  }
  @media (max-width: 900px) {
    .calendar-head,
    .calendar-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 640px) {
    .week-grid,
    .event-list article {
      grid-template-columns: 1fr;
    }
  }
</style>

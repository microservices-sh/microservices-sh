<script lang="ts">
  import { statusBadgeVariant } from "$lib/status";
  import { Button, Card, Eyebrow, Badge } from "$lib/ui";
  import Icon from "$lib/components/Icon.svelte";
  let { data } = $props();

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: data.timezone }).format(
      new Date(iso),
    );
</script>

<main class="section">
  <div class="content-grid">
    <section>
      <Eyebrow><Icon name="list" /> Admin</Eyebrow>
      <h1>Bookings.</h1>
      <p>Review scheduled bookings and inspect the module-owned records that agents can safely extend.</p>
      <p>
        <Button href="/admin/calendar" variant="ghost"><Icon name="calendar" /> Calendar view</Button>
        <Button href="/admin" variant="ghost">Overview</Button>
      </p>
    </section>

    <Card>
      <h2>All bookings</h2>

      <form method="GET" class="filter-bar">
        <label class="filter-search">
          <Icon name="search" size={16} />
          <input type="search" name="q" placeholder="Search customer or service" value={data.q} />
        </label>
        <select name="status" aria-label="Filter by status">
          <option value="">All statuses</option>
          {#each data.statuses as s}
            <option value={s} selected={s === data.status}>{s}</option>
          {/each}
        </select>
        <Button type="submit" variant="ghost">Filter</Button>
      </form>

      <p class="filter-count">
        {data.bookings.length} of {data.total} booking{data.total === 1 ? "" : "s"}{data.status || data.q ? " (filtered)" : ""}
      </p>

      {#if data.bookings.length === 0}
        <p>No bookings match.</p>
      {:else}
        <ul class="list">
          {#each data.bookings as booking}
            <li class="list-item row-item">
              <div>
                <a href={`/admin/bookings/${booking.id}`}><strong>{booking.customerName}</strong></a>
                <p>{booking.serviceName} · {fmt(booking.startsAt)}</p>
              </div>
              <Badge tone={statusBadgeVariant(booking.status)}>{booking.status}</Badge>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>
  </div>
</main>

<style>
  .filter-bar {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }
  .filter-search {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    flex: 1;
    min-width: 12rem;
    padding: 0 0.7rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--radius-control);
    color: var(--color-muted);
  }
  .filter-search input {
    border: 0;
    background: transparent;
    padding: 0.55rem 0;
    flex: 1;
    color: var(--color-ink);
    outline: none;
  }
  .filter-bar select {
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--radius-control);
    background: var(--color-surface);
    color: var(--color-ink);
  }
  .filter-count {
    color: var(--color-muted);
    font-size: 0.85rem;
    margin: 0 0 0.75rem;
  }
</style>

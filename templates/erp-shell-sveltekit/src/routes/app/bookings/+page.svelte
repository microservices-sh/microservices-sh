<script lang="ts">
  import { PageHeader, Card, Badge, ResourceTable, EmptyState } from "$lib/ui";

  let { data } = $props();

  const when = (iso: string) => new Date(iso).toLocaleString();

  function tone(status: string): "good" | "warn" | "bad" | "neutral" {
    switch (status) {
      case "confirmed":
        return "good";
      case "cancelled":
        return "bad";
      case "pending":
        return "warn";
      default:
        return "neutral";
    }
  }
</script>

<svelte:head>
  <title>Bookings · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Appointments"
    title="Bookings"
    description="Scheduled appointments for your company, powered by the booking module."
  />

  <Card title="Schedule">
    {#snippet header()}
      <Badge tone="neutral">{data.bookings.length}</Badge>
    {/snippet}
    {#if data.bookings.length > 0}
      <ResourceTable class="flush" caption="Booking schedule">
        {#snippet head()}
          <tr>
            <th>Customer</th>
            <th>Service</th>
            <th>When</th>
            <th>Status</th>
            <th></th>
          </tr>
        {/snippet}
        {#each data.bookings as b (b.id)}
          <tr>
            <td data-label="Customer">
              <a class="table-primary" href={`/app/bookings/${b.id}`}>{b.customerName}</a>
            </td>
            <td data-label="Service">{b.serviceName}</td>
            <td data-label="When" class="table-muted">{when(b.startsAt)}</td>
            <td data-label="Status"><Badge tone={tone(b.status)}>{b.status}</Badge></td>
            <td class="row-go" aria-hidden="true">
              <a href={`/app/bookings/${b.id}`} tabindex="-1">→</a>
            </td>
          </tr>
        {/each}
      </ResourceTable>
    {:else}
      <EmptyState
        title="No bookings yet"
        description="Appointments appear here once booked against a service."
      />
    {/if}
  </Card>
</main>

<style>
  .row-go {
    text-align: end;
    inline-size: 1%;
    white-space: nowrap;
  }
  .row-go a {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    text-decoration: none;
    transition: transform 150ms var(--ease), color 150ms var(--ease);
    display: inline-block;
  }
  /* Nudge + tint the chevron when its row is hovered (row hover lives in ResourceTable). */
  :global(.resource-table tbody tr:hover) .row-go a {
    color: var(--color-act);
    transform: translateX(3px);
  }
</style>

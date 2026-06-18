<script lang="ts">
  import { enhance } from "$app/forms";
  import { Card, Eyebrow, Badge, Button, Alert } from "$lib/ui";

  let { data, form } = $props();

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
  <Eyebrow>Appointments</Eyebrow>
  <h1>Bookings</h1>
  <p>Scheduled appointments for your company, powered by the booking module.</p>

  {#if form?.cancelled}
    <Alert tone="success">Booking cancelled.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <Card class="mt-6">
    <h2>Schedule</h2>
    {#if data.bookings.length > 0}
      <ul class="list" role="list">
        {#each data.bookings as b}
          <li class="list-item row-item">
            <span><strong>{b.customerName}</strong> · {b.serviceName}<span class="bk-meta">{when(b.startsAt)}</span></span>
            <span class="nav" style="align-items: center;">
              <Badge tone={tone(b.status)}>{b.status}</Badge>
              {#if data.canManage && b.status !== "cancelled"}
                <form method="POST" action="?/cancel" use:enhance>
                  <input type="hidden" name="id" value={b.id} />
                  <Button type="submit" variant="ghost" size="sm">Cancel</Button>
                </form>
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty">No bookings yet. Appointments appear here once booked against a service.</p>
    {/if}
  </Card>
</main>

<style>
  .bk-meta {
    display: block;
    font-size: 0.78rem;
    font-family: var(--font-mono);
    color: var(--color-ink-faint);
  }
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
</style>

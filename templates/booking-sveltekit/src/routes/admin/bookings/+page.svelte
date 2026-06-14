<script lang="ts">
  import { statusPillClass } from "$lib/status";
  let { data } = $props();
</script>

<main class="section">
  <div class="content-grid">
    <section>
      <p class="eyebrow">Admin</p>
      <h1>Bookings.</h1>
      <p>Review scheduled bookings and inspect the module-owned records that agents can safely extend.</p>
      <p><a class="button secondary" href="/admin">Back to overview</a></p>
    </section>

    <section class="panel">
      <h2>All bookings</h2>
      {#if data.bookings.length === 0}
        <p>No bookings yet.</p>
      {:else}
        <ul class="list">
          {#each data.bookings as booking}
            <li class="list-item row-item">
              <div>
                <a href={`/admin/bookings/${booking.id}`}><strong>{booking.customerName}</strong></a>
                <p>
                  {booking.serviceName} · {new Date(booking.startsAt).toLocaleString()}
                </p>
              </div>
              <span class={statusPillClass(booking.status)}>{booking.status}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</main>

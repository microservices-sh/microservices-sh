<script lang="ts">
  let { data } = $props();
</script>

<main class="section">
  <div class="content-grid">
    <section>
      <p class="eyebrow">Admin</p>
      <h1>Booking operations.</h1>
      <p>
        This admin surface stays intentionally compact for the MVP. The richer admin shell
        should be an optional module once core booking behavior is stable.
      </p>
      <div class="stat-grid" aria-label="Operational totals">
        <a class="stat-card" href="/admin/bookings">
          <span>Bookings</span>
          <strong>{data.counts.bookings}</strong>
        </a>
        <a class="stat-card" href="/admin/customers">
          <span>Customers</span>
          <strong>{data.counts.customers}</strong>
        </a>
      </div>
    </section>

    <section class="panel">
      <h2>Recent bookings</h2>
      {#if data.bookings.length === 0}
        <p>No bookings yet.</p>
      {:else}
        <ul class="list">
          {#each data.bookings as booking}
            <li class="list-item">
              <a href={`/admin/bookings/${booking.id}`}><strong>{booking.customerName}</strong></a><br />
              {booking.serviceName} · {new Date(booking.startsAt).toLocaleString()}<br />
              <span>{booking.status}</span>
            </li>
          {/each}
        </ul>
      {/if}
      <p><a class="button secondary" href="/admin/bookings">View all bookings</a></p>
    </section>

    <section class="panel">
      <h2>Recent customers</h2>
      {#if data.customers.length === 0}
        <p>No customers yet.</p>
      {:else}
        <ul class="list">
          {#each data.customers as customer}
            <li class="list-item">
              <a href={`/admin/customers/${customer.id}`}><strong>{customer.name}</strong></a><br />
              {customer.email}<br />
              <span>Updated {new Date(customer.updatedAt).toLocaleString()}</span>
            </li>
          {/each}
        </ul>
      {/if}
      <p><a class="button secondary" href="/admin/customers">View all customers</a></p>
    </section>
  </div>
</main>

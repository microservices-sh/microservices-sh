<script lang="ts">
  let { data } = $props();
</script>

<main class="section">
  <div class="content-grid">
    <section>
      <p class="eyebrow">Customer detail</p>
      <h1>{data.customer.name}</h1>
      <p>{data.customer.email}</p>
      <p><a class="button secondary" href="/admin/customers">Back to customers</a></p>
    </section>

    <section class="panel">
      <h2>Profile</h2>
      <dl class="detail-list">
        <div>
          <dt>Email</dt>
          <dd><a href={`mailto:${data.customer.email}`}>{data.customer.email}</a></dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{data.customer.phone || "Not captured"}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{new Date(data.customer.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{new Date(data.customer.updatedAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd><code>{data.customer.id}</code></dd>
        </div>
      </dl>
    </section>

    <section class="panel">
      <h2>Bookings</h2>
      {#if data.bookings.length === 0}
        <p>No bookings for this customer.</p>
      {:else}
        <ul class="list">
          {#each data.bookings as booking}
            <li class="list-item">
              <a href={`/admin/bookings/${booking.id}`}><strong>{booking.serviceName}</strong></a><br />
              {new Date(booking.startsAt).toLocaleString()}<br />
              <span>{booking.status}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</main>

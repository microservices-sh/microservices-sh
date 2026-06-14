<script lang="ts">
  import { statusPillClass } from "$lib/status";
  let { data } = $props();
</script>

<main class="section">
  <div class="content-grid">
    <section>
      <p class="eyebrow">Booking detail</p>
      <h1>{data.booking.customerName}</h1>
      <p>
        {data.booking.serviceName} at {new Date(data.booking.startsAt).toLocaleString()}.
      </p>
      <p><a class="button secondary" href="/admin/bookings">Back to bookings</a></p>
    </section>

    <section class="panel">
      <h2>Record</h2>
      <dl class="detail-list">
        <div>
          <dt>Status</dt>
          <dd><span class={statusPillClass(data.booking.status)}>{data.booking.status}</span></dd>
        </div>
        <div>
          <dt>Customer</dt>
          <dd><a href={`/admin/customers/${data.booking.customerId}`}>{data.booking.customerName}</a></dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd><a href={`mailto:${data.booking.customerEmail}`}>{data.booking.customerEmail}</a></dd>
        </div>
        <div>
          <dt>Starts</dt>
          <dd>{new Date(data.booking.startsAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Ends</dt>
          <dd>{new Date(data.booking.endsAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd><code>{data.booking.id}</code></dd>
        </div>
      </dl>
    </section>

    <section class="panel">
      <h2>Notes</h2>
      <p>{data.booking.notes || "No notes captured."}</p>
    </section>
  </div>
</main>

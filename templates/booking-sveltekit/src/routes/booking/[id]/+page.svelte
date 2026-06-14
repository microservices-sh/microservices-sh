<script lang="ts">
  let { data } = $props();
</script>

<main class="section">
  <section class="panel">
    <p class="eyebrow">Confirmed</p>
    <h1>Booking saved.</h1>
    <p>
      {data.booking.customerName} is booked for {data.booking.serviceName} at
      {new Date(data.booking.startsAt).toLocaleString()}.
    </p>
    <div class="status">Reference: {data.booking.id}</div>
    <p><a class="button secondary" href="/book">Create another booking</a></p>
  </section>
</main>

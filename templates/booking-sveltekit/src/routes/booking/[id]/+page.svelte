<script lang="ts">
  let { data, form } = $props();

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: data.timezone }).format(
      new Date(iso),
    );

  const cancelled = $derived(form?.cancelled || data.booking.status === "cancelled");
</script>

<main class="section">
  <section class="panel">
    <p class="eyebrow">{cancelled ? "Cancelled" : "Confirmed"}</p>
    <h1>{cancelled ? "Booking cancelled." : "Booking saved."}</h1>
    <p>
      {data.booking.customerName} — {data.booking.serviceName} at {fmt(data.booking.startsAt)}.
    </p>
    <div class="status">Reference: {data.booking.id}</div>

    {#if form?.error}
      <p class="pill is-danger">{form.error}</p>
    {/if}

    <div class="field-grid" style="margin-top:1rem">
      <a class="button secondary" href="/book">Create another booking</a>
      {#if !cancelled && data.cancel.allowed}
        <form method="POST" action="?/cancel">
          <button type="submit" class="button">Cancel booking</button>
        </form>
      {:else if !cancelled && data.cancel.reason}
        <p class="pill is-muted">{data.cancel.reason}</p>
      {/if}
    </div>
  </section>
</main>

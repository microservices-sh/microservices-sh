<script lang="ts">
  import { statusPillClass } from "$lib/status";
  let { data, form } = $props();

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: data.timezone }).format(
      new Date(iso),
    );

  const open = $derived((data.rescheduleSlots ?? []).filter((s) => s.available));
  const isCancelled = $derived(data.booking.status === "cancelled" || form?.cancelled);
</script>

<main class="section">
  <div class="content-grid">
    <section>
      <p class="eyebrow">Booking detail</p>
      <h1>{data.booking.customerName}</h1>
      <p>{data.booking.serviceName} at {fmt(data.booking.startsAt)}.</p>
      <p><a class="button secondary" href="/admin/bookings">Back to bookings</a></p>
    </section>

    <section class="panel">
      <h2>Record</h2>
      <dl class="detail-list">
        <div>
          <dt>Status</dt>
          <dd><span class={statusPillClass(isCancelled ? "cancelled" : data.booking.status)}>{isCancelled ? "cancelled" : data.booking.status}</span></dd>
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
          <dd>{fmt(data.booking.startsAt)}</dd>
        </div>
        <div>
          <dt>Ends</dt>
          <dd>{fmt(data.booking.endsAt)}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd><code>{data.booking.id}</code></dd>
        </div>
      </dl>
    </section>

    {#if !isCancelled}
      <section class="panel">
        <h2>Manage</h2>
        {#if form?.error}
          <p class="pill is-danger">{form.error}</p>
        {/if}

        <h3>Reschedule</h3>
        <form method="GET" class="field-grid">
          <div class="field">
            <label for="date">New date</label>
            <input type="date" id="date" name="date" value={data.rescheduleDate ?? ""} />
          </div>
          <button type="submit" class="button secondary">Find times</button>
        </form>

        {#if data.rescheduleDate}
          {#if open.length}
            <form method="POST" action="?/reschedule">
              <fieldset>
                <legend>Open times on {data.rescheduleDate}</legend>
                <div class="list">
                  {#each open as slot, i}
                    <label class="list-item">
                      <input type="radio" name="startsAt" value={slot.startsAt} required checked={i === 0} />
                      {fmt(slot.startsAt)}
                    </label>
                  {/each}
                </div>
              </fieldset>
              <button type="submit" class="button">Move booking</button>
            </form>
          {:else}
            <p class="pill is-muted">No open times on {data.rescheduleDate}.</p>
          {/if}
        {/if}

        <h3 style="margin-top:1.5rem">Cancel</h3>
        <form method="POST" action="?/cancel">
          <button type="submit" class="button">Cancel booking</button>
        </form>
      </section>
    {/if}

    <section class="panel">
      <h2>Notes</h2>
      <p>{data.booking.notes || "No notes captured."}</p>
    </section>
  </div>
</main>

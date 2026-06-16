<script lang="ts">
  import { statusBadgeVariant } from "$lib/status";
  import { Button, Field, Panel, Eyebrow, Badge } from "$lib/components";
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
      <Eyebrow>Booking detail</Eyebrow>
      <h1>{data.booking.customerName}</h1>
      <p>{data.booking.serviceName} at {fmt(data.booking.startsAt)}.</p>
      <p><Button href="/admin/bookings" variant="secondary">Back to bookings</Button></p>
    </section>

    <Panel>
      <h2>Record</h2>
      <dl class="detail-list">
        <div>
          <dt>Status</dt>
          <dd><Badge variant={statusBadgeVariant(isCancelled ? "cancelled" : data.booking.status)}>{isCancelled ? "cancelled" : data.booking.status}</Badge></dd>
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
    </Panel>

    {#if !isCancelled}
      <Panel>
        <h2>Manage</h2>
        {#if form?.error}
          <Badge variant="danger">{form.error}</Badge>
        {/if}

        <h3>Reschedule</h3>
        <form method="GET" class="field-grid">
          <Field label="New date" id="date">
            <input type="date" id="date" name="date" value={data.rescheduleDate ?? ""} />
          </Field>
          <Button variant="secondary">Find times</Button>
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
              <Button>Move booking</Button>
            </form>
          {:else}
            <Badge variant="muted">No open times on {data.rescheduleDate}.</Badge>
          {/if}
        {/if}

        <h3 style="margin-top:1.5rem">Cancel</h3>
        <form method="POST" action="?/cancel">
          <Button>Cancel booking</Button>
        </form>
      </Panel>
    {/if}

    <Panel>
      <h2>Notes</h2>
      <p>{data.booking.notes || "No notes captured."}</p>
    </Panel>
  </div>
</main>

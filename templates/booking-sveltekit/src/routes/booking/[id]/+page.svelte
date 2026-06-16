<script lang="ts">
  import { Button, Panel, StatusMessage, Eyebrow, Badge } from "$lib/components";

  let { data, form } = $props();

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: data.timezone }).format(
      new Date(iso),
    );

  const cancelled = $derived(form?.cancelled || data.booking.status === "cancelled");
</script>

<main class="section">
  <Panel>
    <Eyebrow>{cancelled ? "Cancelled" : "Confirmed"}</Eyebrow>
    <h1>{cancelled ? "Booking cancelled." : "Booking saved."}</h1>
    <p>
      {data.booking.customerName} — {data.booking.serviceName} at {fmt(data.booking.startsAt)}.
    </p>
    <StatusMessage>Reference: {data.booking.id}</StatusMessage>

    {#if form?.error}
      <Badge variant="danger">{form.error}</Badge>
    {/if}

    <div class="field-grid" style="margin-top:1rem">
      <Button href="/book" variant="secondary">Create another booking</Button>
      {#if !cancelled && data.cancel.allowed}
        <form method="POST" action="?/cancel">
          <input type="hidden" name="t" value={data.manageToken} />
          <Button>Cancel booking</Button>
        </form>
      {:else if !cancelled && data.cancel.reason}
        <Badge variant="muted">{data.cancel.reason}</Badge>
      {/if}
    </div>
  </Panel>
</main>

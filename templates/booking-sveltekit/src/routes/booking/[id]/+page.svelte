<script lang="ts">
  import { Button, Card, Alert, Eyebrow, Badge } from "$lib/ui";

  let { data, form } = $props();

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: data.timezone }).format(
      new Date(iso),
    );

  const cancelled = $derived(form?.cancelled || data.booking.status === "cancelled");
</script>

<main class="section">
  <Card>
    <Eyebrow>{cancelled ? "Cancelled" : "Confirmed"}</Eyebrow>
    <h1>{cancelled ? "Booking cancelled." : "Booking saved."}</h1>
    <p>
      {data.booking.customerName} — {data.booking.serviceName} at {fmt(data.booking.startsAt)}.
    </p>
    <Alert tone="success">Reference: {data.booking.id}</Alert>

    {#if form?.error}
      <Badge tone="bad">{form.error}</Badge>
    {/if}

    <div class="field-grid" style="margin-top:1rem">
      <Button href="/book" variant="ghost">Create another booking</Button>
      {#if !cancelled && data.cancel.allowed}
        <form method="POST" action="?/cancel">
          <input type="hidden" name="t" value={data.manageToken} />
          <Button type="submit" variant="primary">Cancel booking</Button>
        </form>
      {:else if !cancelled && data.cancel.reason}
        <Badge tone="neutral">{data.cancel.reason}</Badge>
      {/if}
    </div>
  </Card>
</main>

<script lang="ts">
  import { enhance } from "$app/forms";
  import { PageHeader, Card, Badge, Button, Alert, FormActions, WorkflowTimeline } from "$lib/ui";

  let { data, form } = $props();
  const b = $derived(data.booking);

  let submitting = $state(false);

  function cancelEnhance() {
    submitting = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      submitting = false;
      await update();
    };
  }
</script>

<svelte:head>
  <title>{b.serviceName || b.customerName} · Bookings · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="Booking" title={b.serviceName || b.customerName}>
    {#snippet actions()}
      <Button href="/app/bookings" variant="ghost">← Bookings</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={b.tone}>{b.status}</Badge>
      <span>·</span>
      {#if b.customerId}
        <a href={`/app/customers/${b.customerId}`}>{b.customerName}</a>
      {:else}
        <span>{b.customerName}</span>
      {/if}
    {/snippet}
  </PageHeader>

  {#if form?.cancelled}
    <Alert tone="success">Booking cancelled.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="grid">
    <div class="grid__main">
      <Card title="Summary">
        <dl class="detail-list">
          <div>
            <dt>Customer</dt>
            <dd>
              {#if b.customerId}
                <a href={`/app/customers/${b.customerId}`}>{b.customerName}</a>
              {:else}
                {b.customerName}
              {/if}
            </dd>
          </div>
          <div><dt>Service</dt><dd>{b.serviceName}</dd></div>
          <div><dt>When</dt><dd>{b.starts} – {b.ends}</dd></div>
          <div><dt>Status</dt><dd><Badge tone={b.tone}>{b.status}</Badge></dd></div>
          <div><dt>Notes</dt><dd>{b.notes ?? "—"}</dd></div>
          <div><dt>Created</dt><dd>{b.created ?? "—"}</dd></div>
        </dl>
      </Card>

      <Card title="Activity">
        <WorkflowTimeline events={data.timeline} emptyLabel="No activity recorded for this booking yet." />
      </Card>
    </div>

    <div class="grid__side">
      {#if data.canManage && !b.isCancelled}
        <Card title="Cancel booking">
          <p class="status-note">Cancelling frees the slot and notifies the booking module.</p>
          <form method="POST" action="?/cancel" use:enhance={cancelEnhance} class="danger">
            <FormActions submitLabel="Cancel booking" submittingLabel="Cancelling…" {submitting} />
          </form>
        </Card>
      {:else}
        <Card title="Status">
          <p class="status-note">This booking is <strong>{b.status}</strong>.</p>
        </Card>
      {/if}
    </div>
  </div>
</main>

<style>
  .grid {
    display: grid;
    gap: 18px;
    margin-block-start: 4px;
    grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.85fr);
    align-items: start;
  }
  .grid__main,
  .grid__side {
    display: grid;
    gap: 16px;
    min-inline-size: 0;
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .status-note {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-ink-soft);
  }
  /* Destructive tint for the Cancel submit button. */
  .danger :global(button[type="submit"]) {
    background: var(--color-red);
    border-color: var(--color-red);
    color: var(--color-panel);
  }
</style>

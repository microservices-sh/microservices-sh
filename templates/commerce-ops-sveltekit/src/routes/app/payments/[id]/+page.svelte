<script lang="ts">
  import { enhance } from "$app/forms";
  import { PageHeader, Card, Badge, Button, Alert, FormActions, WorkflowTimeline } from "$lib/ui";

  let { data, form } = $props();
  const pay = $derived(data.payment);

  let submitting = $state(false);

  function refundEnhance() {
    submitting = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      submitting = false;
      await update();
    };
  }
</script>

<svelte:head>
  <title>{pay.reference} · Payments · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="Payment" title={pay.amount}>
    {#snippet actions()}
      <Button href="/app/payments" variant="ghost">← Payments</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={pay.tone}>{pay.status}</Badge>
      {#if pay.customerName}
        <span>·</span>
        {#if pay.customerId}
          <a href={`/app/customers/${pay.customerId}`}>{pay.customerName}</a>
        {:else}
          <span>{pay.customerName}</span>
        {/if}
      {/if}
    {/snippet}
  </PageHeader>

  {#if form?.refunded}
    <Alert tone="success">Payment refunded.</Alert>
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
              {#if pay.customerName}
                {#if pay.customerId}
                  <a href={`/app/customers/${pay.customerId}`}>{pay.customerName}</a>
                {:else}{pay.customerName}{/if}
              {:else}—{/if}
            </dd>
          </div>
          <div><dt>Amount</dt><dd class="num strong">{pay.amount}</dd></div>
          <div><dt>Status</dt><dd><Badge tone={pay.tone}>{pay.status}</Badge></dd></div>
          <div><dt>Description</dt><dd>{pay.description ?? "—"}</dd></div>
          <div><dt>Created</dt><dd>{pay.created ?? "—"}</dd></div>
        </dl>
      </Card>

      <Card title="Activity">
        <WorkflowTimeline events={data.timeline} emptyLabel="No activity recorded for this payment yet." />
      </Card>
    </div>

    <div class="grid__side">
      {#if data.canManage && pay.refundable}
        <Card title="Refund">
          <form method="POST" action="?/refund" use:enhance={refundEnhance}>
            <p class="status-note">Refund {pay.amount} back to the customer through the payment gateway.</p>
            <FormActions submitLabel="Refund" submittingLabel="Refunding…" {submitting} />
          </form>
        </Card>
      {:else}
        <Card title="Status">
          <p class="status-note">
            This payment is <strong>{pay.status}</strong>.
          </p>
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
  .num {
    font-variant-numeric: tabular-nums;
  }
  .strong {
    font-weight: 600;
    color: var(--color-ink);
  }
  .status-note {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-ink-soft);
  }
</style>

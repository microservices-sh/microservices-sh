<script lang="ts">
  import { enhance } from "$app/forms";
  import { PageHeader, Card, Badge, Button, Alert, WorkflowTimeline } from "$lib/ui";

  let { data, form } = $props();
  const s = $derived(data.subscription);

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
  <title>{s.customerName} · Billing · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="Subscription" title={s.customerName}>
    {#snippet actions()}
      <Button href="/app/billing" variant="ghost">← Billing</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={s.tone}>{s.status}</Badge>
      <span>·</span>
      <span>{s.planName}</span>
    {/snippet}
  </PageHeader>

  {#if form?.canceled}
    <Alert tone="success">Subscription canceled.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="grid">
    <div class="grid__main">
      <Card title="Summary">
        <dl class="detail-list">
          <div>
            <dt>Customer</dt>
            <dd><a href={`/app/customers/${s.subscriberId}`}>{s.customerName}</a></dd>
          </div>
          <div><dt>Plan</dt><dd>{s.planName}</dd></div>
          <div><dt>Price</dt><dd>{s.planPrice}</dd></div>
          <div><dt>Status</dt><dd><Badge tone={s.tone}>{s.status}</Badge></dd></div>
          <div><dt>Renewal</dt><dd>{s.cancelAtPeriodEnd ? "Cancels at period end" : "Auto-renews"}</dd></div>
        </dl>
      </Card>

      <Card title="Activity">
        <WorkflowTimeline events={data.timeline} emptyLabel="No activity recorded for this subscription yet." />
      </Card>
    </div>

    <div class="grid__side">
      {#if s.isActive && data.canManage}
        <Card title="Cancel subscription">
          <p class="note">End this subscription. The customer stops being billed at the next cycle.</p>
          <form method="POST" action="?/cancel" use:enhance={cancelEnhance}>
            <div class="cancel-actions">
              <Button type="submit" variant="ghost" class="danger" disabled={submitting}>
                {submitting ? "Canceling…" : "Cancel subscription"}
              </Button>
            </div>
          </form>
        </Card>
      {:else}
        <Card title="Status">
          <p class="note">This subscription is {s.status}.</p>
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
  .note {
    margin: 0 0 14px;
    font-size: 0.88rem;
    color: var(--color-ink-soft);
  }
  .cancel-actions {
    display: flex;
    justify-content: flex-end;
  }
  .cancel-actions :global(.btn.danger:hover) {
    border-color: var(--color-red);
    color: var(--color-red);
  }
</style>

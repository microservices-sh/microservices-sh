<script lang="ts">
  import { money } from "$lib/format";
  import { Badge, Card, MetricStrip, PageHeader } from "$lib/ui";
  import type { Metric } from "$lib/ui/types";

  let { data } = $props();

  const totalOpen = $derived(data.aging?.totalOpenCents ?? 0);
  const overdue = $derived((data.aging?.days1To30Cents ?? 0) + (data.aging?.days31To60Cents ?? 0) + (data.aging?.days61To90Cents ?? 0) + (data.aging?.days90PlusCents ?? 0));
  const metrics = $derived<Metric[]>([
    { label: "Open AR", value: money(totalOpen), tone: totalOpen > 0 ? "warn" : "good", hint: `${data.receivables.length} invoices` },
    { label: "Overdue", value: money(overdue), tone: overdue > 0 ? "bad" : "good", hint: "past due buckets" },
    { label: "Current", value: money(data.aging?.currentCents ?? 0), tone: "good", hint: data.status.status }
  ]);
</script>

<svelte:head>
  <title>Receivables · Accounting ERP</title>
</svelte:head>

<main class="section receivables-page">
  <PageHeader
    eyebrow="Accounts receivable"
    title="Receivables"
    description="Open invoice snapshots, customer payment application, and AR aging contract surface."
  />

  <MetricStrip {metrics} />

  <div class="grid mt-6">
    <Card title="Open receivables">
      {#if data.receivables.length > 0}
        <ul class="list">
          {#each data.receivables as invoice (invoice.id)}
            <li class="list-item row-item">
              <div>
                <strong>{invoice.invoiceNumber}</strong>
                <p>{invoice.customerId} · due {new Date(invoice.dueDate).toLocaleDateString()}</p>
              </div>
              <Badge tone={Date.parse(invoice.dueDate) < Date.parse("2026-06-21T00:00:00.000Z") ? "bad" : "warn"}>{money(invoice.amountDueCents)}</Badge>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No open receivables.</p>
      {/if}
    </Card>

    <Card title="Aging buckets">
      {#if data.aging}
        <dl class="stats">
          <div><dt>Current</dt><dd>{money(data.aging.currentCents)}</dd></div>
          <div><dt>1-30 days</dt><dd>{money(data.aging.days1To30Cents)}</dd></div>
          <div><dt>31-60 days</dt><dd>{money(data.aging.days31To60Cents)}</dd></div>
          <div><dt>61-90 days</dt><dd>{money(data.aging.days61To90Cents)}</dd></div>
          <div><dt>90+ days</dt><dd>{money(data.aging.days90PlusCents)}</dd></div>
        </dl>
      {/if}
    </Card>
  </div>
</main>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 0.8fr);
    gap: 16px;
  }
  .stats {
    display: grid;
    gap: 10px;
    margin: 0;
  }
  .stats div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-block-end: 1px solid var(--color-line);
    padding-block-end: 10px;
  }
  .stats dt {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .stats dd {
    margin: 0;
  }
  .empty,
  p {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 860px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>

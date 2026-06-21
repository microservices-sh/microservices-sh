<script lang="ts">
  import { enhance } from "$app/forms";
  import { money } from "$lib/format";
  import { Alert, Badge, Button, Card, Field, MetricStrip, PageHeader } from "$lib/ui";
  import type { Metric } from "$lib/ui/types";

  let { data, form } = $props();

  const totalOpen = $derived(data.aging?.totalOpenCents ?? 0);
  const overdue = $derived((data.aging?.days1To30Cents ?? 0) + (data.aging?.days31To60Cents ?? 0) + (data.aging?.days61To90Cents ?? 0) + (data.aging?.days90PlusCents ?? 0));
  const metrics = $derived<Metric[]>([
    { label: "Open AR", value: money(totalOpen), tone: totalOpen > 0 ? "warn" : "good", hint: `${data.receivables.length} invoices` },
    { label: "Overdue", value: money(overdue), tone: overdue > 0 ? "bad" : "good", hint: "past due buckets" },
    { label: "Current", value: money(data.aging?.currentCents ?? 0), tone: "good", hint: data.status.status }
  ]);

  function inputId(prefix: string, invoiceId: string): string {
    return `${prefix}-${invoiceId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  }

  function amountInputValue(amountDueCents: number): string {
    return (amountDueCents / 100).toFixed(2);
  }
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

  {#if form?.paymentRecorded}
    <Alert tone={form.syncWarning ? "warning" : "success"}>
      {form.paid ? "Invoice paid and receivables updated." : "Invoice payment recorded and receivables updated."}{#if form.syncWarning} Receivables sync needs retry: {form.syncWarning}{/if}
    </Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <MetricStrip {metrics} />

  <div class="grid mt-6">
    <Card title="Open receivables">
      {#if data.receivables.length > 0}
        <ul class="list">
          {#each data.receivables as invoice (invoice.id)}
            <li class="list-item row-item">
              <div class="invoice-copy">
                <strong>{invoice.invoiceNumber}</strong>
                <p>{invoice.customerName} · due {new Date(invoice.dueDate).toLocaleDateString()}</p>
              </div>
              <div class="invoice-actions">
                <Badge tone={Date.parse(invoice.dueDate) < Date.parse(`${data.reportDate}T00:00:00.000Z`) ? "bad" : "warn"}>{money(invoice.amountDueCents)}</Badge>
                <Button href={`/app/reports?asOf=${data.reportDate}&customerId=${invoice.customerId}`} variant="ghost" size="sm">Statement</Button>
                {#if data.canManage && invoice.canRecordPayment}
                  <form class="payment-form" method="POST" action="?/recordPayment" use:enhance>
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <input type="hidden" name="paymentKey" value={invoice.paymentKey} />
                    <div class="payment-fields">
                      <Field label="Amount" id={inputId("payment-amount", invoice.id)}>
                        <input
                          id={inputId("payment-amount", invoice.id)}
                          name="amount"
                          type="number"
                          min="0.01"
                          max={amountInputValue(invoice.amountDueCents)}
                          step="0.01"
                          value={amountInputValue(invoice.amountDueCents)}
                        />
                      </Field>
                      <Field label="Date" id={inputId("payment-date", invoice.id)}>
                        <input id={inputId("payment-date", invoice.id)} name="paymentDate" type="date" value={data.reportDate} />
                      </Field>
                    </div>
                    <Button type="submit" variant="primary" size="sm">Apply</Button>
                  </form>
                {:else if data.canManage}
                  <Badge tone="neutral">demo</Badge>
                {/if}
              </div>
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
  .row-item {
    align-items: flex-start;
    gap: 18px;
  }
  .invoice-copy {
    min-inline-size: 0;
  }
  .invoice-actions {
    display: grid;
    justify-items: end;
    gap: 10px;
    min-inline-size: min(100%, 360px);
  }
  .payment-form {
    display: grid;
    gap: 10px;
    justify-items: end;
    inline-size: 100%;
  }
  .payment-fields {
    display: grid;
    grid-template-columns: minmax(100px, 1fr) minmax(132px, 1fr);
    gap: 10px;
    inline-size: 100%;
  }
  .payment-form :global(.field) {
    margin-block-end: 0;
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
    .row-item,
    .invoice-actions,
    .payment-form {
      justify-items: stretch;
    }
    .payment-fields {
      grid-template-columns: 1fr;
    }
  }
</style>

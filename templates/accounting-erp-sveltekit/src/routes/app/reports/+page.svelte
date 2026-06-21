<script>
  import { money } from "$lib/format";
  import { Badge, Button, Card, Field, MetricStrip, PageHeader } from "$lib/ui";

  let { data } = $props();

  const arOpen = $derived(data.arAging?.totalOpenCents ?? 0);
  const apOpen = $derived(data.apAging?.totals.totalCents ?? 0);
  const totalOverdue = $derived((data.arAging?.overdueCents ?? 0) + (data.apAging?.overdueCents ?? 0));
  const metrics = $derived([
    { label: "Open AR", value: money(arOpen), tone: arOpen > 0 ? "warn" : "good", hint: `${data.openReceivables.length} invoices` },
    { label: "Open AP", value: money(apOpen), tone: apOpen > 0 ? "warn" : "good", hint: `${data.apAging?.vendors.length ?? 0} vendors` },
    { label: "Overdue", value: money(totalOverdue), tone: totalOverdue > 0 ? "bad" : "good", hint: data.asOfDay }
  ]);

  const buckets = [
    ["Current", "currentCents"],
    ["1-30", "days1To30Cents"],
    ["31-60", "days31To60Cents"],
    ["61-90", "days61To90Cents"],
    ["90+", "days90PlusCents"]
  ];

  function bucketTone(label) {
    if (label === "Current") return "good";
    if (label === "90+" || label === "61-90") return "bad";
    return "warn";
  }
</script>

<svelte:head>
  <title>Reports · Accounting ERP</title>
</svelte:head>

<main class="section reports-page">
  <PageHeader
    eyebrow="Accounting reports"
    title="Reports"
    description="Aged receivables, aged payables, and customer statement outputs from the accounting modules."
  >
    {#snippet actions()}
      <Button href="/app/ledger" variant="ghost">Ledger</Button>
      <Button href="/app/receivables" variant="ghost">Receivables</Button>
      <Button href="/app/payables" variant="ghost">Payables</Button>
    {/snippet}
  </PageHeader>

  <form class="report-filter mt-6" method="GET">
    <Field label="As of" id="report-as-of">
      <input id="report-as-of" name="asOf" type="date" value={data.asOfDay} />
    </Field>
    <Field label="Customer statement" id="report-customer">
      <select id="report-customer" name="customerId">
        <option value="">No statement</option>
        {#each data.customers as customer (customer.id)}
          <option value={customer.id} selected={data.selectedCustomerId === customer.id}>{customer.name}</option>
        {/each}
      </select>
    </Field>
    <Button type="submit" variant="primary">Run</Button>
  </form>

  <div class="mt-6">
    <MetricStrip {metrics} />
  </div>

  <div class="report-grid mt-6">
    <Card>
      <div class="card-headline">
        <h2>Aged receivables</h2>
        <Badge tone={(data.arAging?.overdueCents ?? 0) > 0 ? "bad" : "good"}>{money(data.arAging?.totalOpenCents ?? 0)}</Badge>
      </div>
      {#if data.arAging}
        <div class="bucket-grid">
          {#each buckets as [label, key]}
            <div>
              <span>{label}</span>
              <strong>{money(data.arAging[key])}</strong>
              <Badge tone={bucketTone(label)}>{label}</Badge>
            </div>
          {/each}
        </div>
      {/if}
      {#if data.openReceivables.length > 0}
        <div class="table-scroll mt-4">
          <table>
            <caption>Open receivables</caption>
            <thead>
              <tr>
                <th scope="col">Invoice</th>
                <th scope="col">Customer</th>
                <th scope="col">Due</th>
                <th scope="col">Open</th>
              </tr>
            </thead>
            <tbody>
              {#each data.openReceivables as invoice (invoice.id)}
                <tr>
                  <td><code>{invoice.invoiceNumber}</code></td>
                  <td>{invoice.customerName}</td>
                  <td>{invoice.daysOverdue > 0 ? `${invoice.daysOverdue} days` : "current"}</td>
                  <td>{money(invoice.amountDueCents)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="empty">No open receivables.</p>
      {/if}
    </Card>

    <Card>
      <div class="card-headline">
        <h2>Aged payables</h2>
        <Badge tone={(data.apAging?.overdueCents ?? 0) > 0 ? "bad" : "good"}>{money(data.apAging?.totals.totalCents ?? 0)}</Badge>
      </div>
      {#if data.apAging}
        <div class="bucket-grid">
          {#each buckets as [label, key]}
            <div>
              <span>{label}</span>
              <strong>{money(data.apAging.totals[key])}</strong>
              <Badge tone={bucketTone(label)}>{label}</Badge>
            </div>
          {/each}
        </div>
        {#if data.apAging.vendors.length > 0}
          <div class="table-scroll mt-4">
            <table>
              <caption>Open payables by vendor</caption>
              <thead>
                <tr>
                  <th scope="col">Vendor</th>
                  <th scope="col">Open</th>
                  <th scope="col">Bills</th>
                </tr>
              </thead>
              <tbody>
                {#each data.apAging.vendors as vendor (vendor.vendorId)}
                  <tr>
                    <td>{vendor.vendorName}</td>
                    <td>{money(vendor.totalCents)}</td>
                    <td>{vendor.bills.length}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="empty">No open payables.</p>
        {/if}
      {/if}
    </Card>
  </div>

  {#if data.statement}
    <Card class="mt-6">
      <div class="card-headline">
        <h2>Customer statement</h2>
        <Badge tone={(data.statement.aging.totalOpenCents ?? 0) > 0 ? "warn" : "good"}>{data.statement.customerName}</Badge>
      </div>
      <div class="statement-summary">
        <div><span>Date</span><strong>{data.statement.statementDate.slice(0, 10)}</strong></div>
        <div><span>Open</span><strong>{money(data.statement.aging.totalOpenCents)}</strong></div>
        <div><span>Invoices</span><strong>{data.statement.invoices.length}</strong></div>
        <div><span>Payments</span><strong>{data.statement.payments.length}</strong></div>
      </div>
      <div class="table-scroll mt-4">
        <table>
          <caption>Statement invoices</caption>
          <thead>
            <tr>
              <th scope="col">Invoice</th>
              <th scope="col">Issued</th>
              <th scope="col">Total</th>
              <th scope="col">Paid</th>
              <th scope="col">Open</th>
            </tr>
          </thead>
          <tbody>
            {#each data.statement.invoices as invoice (invoice.id)}
              <tr>
                <td><code>{invoice.invoiceNumber}</code></td>
                <td>{invoice.issuedAt.slice(0, 10)}</td>
                <td>{money(invoice.totalCents)}</td>
                <td>{money(invoice.amountPaidCents)}</td>
                <td>{money(invoice.amountDueCents)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Card>
  {/if}
</main>

<style>
  .report-filter {
    display: grid;
    grid-template-columns: minmax(160px, 220px) minmax(220px, 1fr) auto;
    align-items: end;
    gap: 12px;
  }
  .report-filter :global(.field) {
    margin-block-end: 0;
  }
  .report-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  .bucket-grid,
  .statement-summary {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
  }
  .bucket-grid div,
  .statement-summary div {
    display: grid;
    gap: 6px;
    border: 1px solid var(--color-line);
    border-radius: 8px;
    padding: 10px;
    min-width: 0;
  }
  .bucket-grid span,
  .statement-summary span {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
  }
  .bucket-grid strong,
  .statement-summary strong {
    overflow-wrap: anywhere;
  }
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 960px) {
    .report-grid,
    .report-filter {
      grid-template-columns: 1fr;
    }
    .bucket-grid,
    .statement-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 560px) {
    .bucket-grid,
    .statement-summary {
      grid-template-columns: 1fr;
    }
  }
</style>

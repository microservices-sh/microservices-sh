<script>
  import { money } from "$lib/format";
  import { Badge, Button, Card, PageHeader } from "$lib/ui";

  let { data } = $props();
  const template = $derived(data.template);
  const cadence = $derived(template.frequency === "custom" ? `every ${template.customDays} days` : template.frequency);
</script>

<svelte:head>
  <title>{template.name} · Recurring Bills · Accounting ERP</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="Recurring bill" title={template.name}>
    {#snippet actions()}
      <Button href="/app/payables" variant="ghost">← Payables</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={template.tone}>{template.status}</Badge>
      <span>·</span>
      <span>{template.vendorName}</span>
    {/snippet}
  </PageHeader>

  <div class="grid">
    <div class="grid__main">
      <Card title="Schedule">
        <dl class="detail-list">
          <div><dt>Status</dt><dd><Badge tone={template.tone}>{template.status}</Badge></dd></div>
          <div><dt>Vendor</dt><dd>{template.vendorName}</dd></div>
          <div><dt>Cadence</dt><dd>{cadence}</dd></div>
          <div><dt>Next bill</dt><dd>{template.nextBillDateShort}</dd></div>
          <div><dt>Last bill</dt><dd>{template.lastBillDateShort}</dd></div>
          <div><dt>Terms</dt><dd>{template.paymentTermsDays} days</dd></div>
          <div><dt>Generated</dt><dd>{template.billsGenerated}</dd></div>
          <div><dt>Max occurrences</dt><dd>{template.maxOccurrences ?? "No limit"}</dd></div>
          <div><dt>Auto mark payable</dt><dd>{template.autoMarkPayable ? "Yes" : "No"}</dd></div>
          <div><dt>Created</dt><dd>{template.created}</dd></div>
          <div><dt>Updated</dt><dd>{template.updated}</dd></div>
        </dl>
      </Card>

      <Card title="Line items">
        {#if template.lineItems.length > 0}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Tax</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {#each template.lineItems as line (line.id)}
                  <tr>
                    <td>{line.description}</td>
                    <td>{line.quantity}</td>
                    <td>{money(line.unitAmountCents, template.currency)}</td>
                    <td>{money(line.taxCents, template.currency)}</td>
                    <td>{money(line.totalCents, template.currency)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="empty">No line items recorded for this schedule.</p>
        {/if}
      </Card>
    </div>

    <div class="grid__side">
      <Card title="Totals">
        <dl class="detail-list compact">
          <div><dt>Subtotal</dt><dd class="num">{template.subtotal}</dd></div>
          <div><dt>Tax</dt><dd class="num">{template.tax}</dd></div>
          <div><dt>Total</dt><dd class="num strong">{template.total}</dd></div>
        </dl>
      </Card>

      <Card title="Lifecycle">
        <div class="stack">
          <p class="status-note">Use the Payables ledger for pause, resume, cancel, and due-generation actions so recurring bill side effects stay in one operator workflow.</p>
          <Button href="/app/payables" variant="ghost">Open payables actions</Button>
        </div>
      </Card>

      {#if template.memo}
        <Card title="Memo">
          <p class="status-note">{template.memo}</p>
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
    grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.85fr);
    align-items: start;
  }
  .grid__main,
  .grid__side,
  .stack {
    display: grid;
    gap: 16px;
    min-inline-size: 0;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    min-width: 620px;
    border-collapse: collapse;
  }
  th,
  td {
    border-block-end: 1px solid var(--color-line);
    padding: 10px 8px;
    text-align: left;
    vertical-align: top;
  }
  th {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .compact {
    grid-template-columns: 1fr;
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
  .strong {
    font-weight: 600;
    color: var(--color-ink);
  }
  .status-note,
  .empty {
    margin: 0;
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>

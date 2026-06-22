<script>
  import { Badge, Button, Card, PageHeader } from "$lib/ui";

  let { data } = $props();
  const bill = $derived(data.bill);
  const paymentHistory = $derived(data.paymentHistory ?? []);
  const canUseActions = $derived(
    bill.status === "draft" ||
      bill.status === "pending_approval" ||
      bill.status === "payable" ||
      bill.status === "partial"
  );
</script>

<svelte:head>
  <title>{bill.billNumber} · Payables · Accounting ERP</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="Vendor bill" title={bill.billNumber}>
    {#snippet actions()}
      <Button href="/app/payables" variant="ghost">Payables</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={bill.statusTone}>{bill.status}</Badge>
      <Badge tone={bill.accountingTone}>{bill.accountingStatus}</Badge>
      <span>{bill.vendorName}</span>
    {/snippet}
  </PageHeader>

  <div class="grid">
    <div class="grid__main">
      <Card title="Bill details">
        <dl class="detail-list">
          <div><dt>Vendor</dt><dd>{bill.vendorName}</dd></div>
          <div><dt>Vendor bill number</dt><dd>{bill.vendorBillNumber ?? "-"}</dd></div>
          <div><dt>Bill date</dt><dd>{bill.billDateShort}</dd></div>
          <div><dt>Due date</dt><dd>{bill.dueDateShort}</dd></div>
          <div><dt>Paid date</dt><dd>{bill.paidAtShort}</dd></div>
          <div><dt>Status</dt><dd><Badge tone={bill.statusTone}>{bill.status}</Badge></dd></div>
          <div><dt>Accounting</dt><dd><Badge tone={bill.accountingTone}>{bill.accountingStatus}</Badge></dd></div>
          <div><dt>AP account</dt><dd>{bill.apAccountLabel}</dd></div>
          <div><dt>Journal entry</dt><dd>{bill.journalEntryId ?? "-"}</dd></div>
          <div><dt>Created</dt><dd>{bill.created}</dd></div>
          <div><dt>Updated</dt><dd>{bill.updated}</dd></div>
        </dl>
      </Card>

      <Card title="Line items">
        {#if bill.lineItems.length > 0}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Expense account</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Tax</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {#each bill.lineItems as line (line.id)}
                  <tr>
                    <td>{line.description}</td>
                    <td>{line.expenseAccountLabel}</td>
                    <td>{line.quantity}</td>
                    <td>{line.unit}</td>
                    <td>{line.tax}</td>
                    <td>{line.total}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="empty">No line items recorded for this bill.</p>
        {/if}
      </Card>

      <Card title="Payment history">
        {#if paymentHistory.length > 0}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Payment</th>
                  <th>Applied</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Journal</th>
                </tr>
              </thead>
              <tbody>
                {#each paymentHistory as payment (payment.id)}
                  <tr>
                    <td>{payment.paymentDateShort}</td>
                    <td>{payment.paymentNumber}</td>
                    <td>{payment.amount}</td>
                    <td>{payment.method}</td>
                    <td>{payment.referenceNumber}</td>
                    <td>{payment.status}</td>
                    <td>{payment.journalEntryId}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="empty">No payments have been applied to this bill.</p>
        {/if}
      </Card>
    </div>

    <div class="grid__side">
      <Card title="Totals">
        <dl class="detail-list compact">
          <div><dt>Subtotal</dt><dd class="num">{bill.subtotal}</dd></div>
          <div><dt>Tax</dt><dd class="num">{bill.tax}</dd></div>
          <div><dt>Total</dt><dd class="num strong">{bill.total}</dd></div>
          <div><dt>Paid</dt><dd class="num">{bill.paid}</dd></div>
          <div><dt>Due</dt><dd class="num strong">{bill.due}</dd></div>
        </dl>
      </Card>

      <Card title="Lifecycle">
        <div class="stack">
          {#if bill.voidedAt}
            <p class="status-note">Voided on {bill.voidedAt.slice(0, 10)}.</p>
            {#if bill.voidReason}<p class="status-note">{bill.voidReason}</p>{/if}
          {:else if canUseActions}
            <p class="status-note">Use the Payables ledger for posting and payment actions so AP side effects stay in one operator workflow.</p>
            <Button href="/app/payables" variant="ghost">Open payables actions</Button>
          {:else}
            <p class="status-note">No open action is required for this bill.</p>
          {/if}
        </div>
      </Card>

      {#if bill.memo}
        <Card title="Memo">
          <p class="status-note">{bill.memo}</p>
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
    min-width: 760px;
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
